import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} from 'discord.js';

const ABSENCE_PANEL_CHANNEL_ID = '1547616377702060082';
const ABSENCE_ADMIN_CHANNEL_ID = '1547678965764980856';

const ABSENCE_COLOR = 0xF8D568;

const EMOJIS = {
    vacation: '<:Vacation:1547149550404239370>',
    pending: '<a:Loading:1546268064008642641>',
    approved: '<a:Yes:1545795445043888239>',
    denied: '<a:No:1545795160586190858>',
};

const STORAGE_PREFIX = 'guild:';
const STORAGE_SUFFIX = ':absence:requests';

const PANEL_STORAGE_PREFIX = 'guild:';
const PANEL_STORAGE_SUFFIX = ':absence:panel';

function getStorageKey(guildId) {
    return `${STORAGE_PREFIX}${guildId}${STORAGE_SUFFIX}`;
}

function getPanelStorageKey(guildId) {
    return `${PANEL_STORAGE_PREFIX}${guildId}${PANEL_STORAGE_SUFFIX}`;
}

function unwrap(data) {
    if (
        data &&
        typeof data === 'object' &&
        data.value !== undefined &&
        data.ok !== undefined
    ) {
        return unwrap(data.value);
    }

    return data;
}

/**
 * Creates a stable JSON representation.
 *
 * Discord builders can contain properties that are not relevant
 * to whether our configured panel actually changed, so we only
 * compare the generated component/embed payload.
 */
function stableStringify(value) {
    if (value === null || value === undefined) {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return `[${value
            .map(item => stableStringify(item))
            .join(',')}]`;
    }

    if (typeof value === 'object') {
        return `{${Object.keys(value)
            .sort()
            .map(
                key =>
                    `${JSON.stringify(key)}:${stableStringify(
                        value[key],
                    )}`,
            )
            .join(',')}}`;
    }

    return JSON.stringify(value);
}

/**
 * Generates the signature for the current configured panel.
 *
 * If ANYTHING that we configure changes, this signature changes.
 */
function getAbsencePanelSignature(panel) {
    return stableStringify({
        embeds: panel.embeds?.map(embed => {
            if (typeof embed?.toJSON === 'function') {
                return embed.toJSON();
            }

            return embed;
        }),

        components: panel.components?.map(component => {
            if (typeof component?.toJSON === 'function') {
                return component.toJSON();
            }

            return component;
        }),
    });
}

export function getStatusDisplay(status) {
    switch (status) {
        case 'approved':
            return `${EMOJIS.approved} Approved`;

        case 'denied':
            return `${EMOJIS.denied} Denied`;

        default:
            return `${EMOJIS.pending} Pending`;
    }
}

export function createAbsencePanel() {
    const embed = new EmbedBuilder()
        .setColor(ABSENCE_COLOR)
        .setTitle(`${EMOJIS.vacation} Fruity Absence`)
        .setDescription(
            'Submit an absence request or check your current request status below.',
        );

    const button = new ButtonBuilder()
        .setCustomId('absence')
        .setLabel('Absence')
        .setEmoji({
            name: 'Vacation',
            id: '1547149550404239370',
        })
        .setStyle(ButtonStyle.Secondary);

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(button),
        ],
    };
}

export function createAdminAbsenceMessage(request) {
    const embed = new EmbedBuilder()
        .setColor(ABSENCE_COLOR)
        .setTitle('New Absence request:')
        .setDescription(
            `**Status:** ${getStatusDisplay(request.status)}\n` +
            `**From:** <@${request.userId}>`,
        )
        .addFields(
            {
                name: '\u200B',
                value: '\u200B',
            },
            {
                name: 'Reason',
                value: `\`${request.reason}\``,
                inline: false,
            },
            {
                name: 'Start Date',
                value: `\`${request.startDate}\``,
                inline: true,
            },
            {
                name: 'End Date',
                value: `\`${request.endDate}\``,
                inline: true,
            },
        );

    const components = [];

    if (request.status === 'pending') {
        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`absence_approve:${request.id}`)
                    .setEmoji({
                        name: 'Yes',
                        id: '1545795445043888239',
                    })
                    .setLabel('Approve')
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId(`absence_deny:${request.id}`)
                    .setEmoji({
                        name: 'No',
                        id: '1545795160586190858',
                    })
                    .setLabel('Deny')
                    .setStyle(ButtonStyle.Danger),
            ),
        );
    }

    return {
        embeds: [embed],
        components,
        allowedMentions: {
            users: [request.userId],
            roles: [],
            repliedUser: false,
        },
    };
}

export async function getAbsenceRequests(client, guildId) {
    if (
        !client?.db ||
        typeof client.db.get !== 'function'
    ) {
        return [];
    }

    try {
        const raw = await client.db.get(
            getStorageKey(guildId),
            [],
        );

        const requests = unwrap(raw);

        return Array.isArray(requests)
            ? requests
            : [];
    } catch {
        return [];
    }
}

export async function saveAbsenceRequests(
    client,
    guildId,
    requests,
) {
    if (
        !client?.db ||
        typeof client.db.set !== 'function'
    ) {
        return false;
    }

    try {
        await client.db.set(
            getStorageKey(guildId),
            requests,
        );

        return true;
    } catch {
        return false;
    }
}

/**
 * Gets the saved panel state.
 *
 * Stored separately from absence requests so panel reconciliation
 * never modifies the actual absence request data.
 */
async function getSavedPanelState(client, guildId) {
    if (
        !client?.db ||
        typeof client.db.get !== 'function'
    ) {
        return null;
    }

    try {
        const raw = await client.db.get(
            getPanelStorageKey(guildId),
            null,
        );

        const data = unwrap(raw);

        if (
            !data ||
            typeof data !== 'object'
        ) {
            return null;
        }

        return {
            messageId:
                typeof data.messageId === 'string'
                    ? data.messageId
                    : null,

            signature:
                typeof data.signature === 'string'
                    ? data.signature
                    : null,
        };
    } catch {
        return null;
    }
}

/**
 * Saves the canonical absence panel state.
 */
async function savePanelState(
    client,
    guildId,
    state,
) {
    if (
        !client?.db ||
        typeof client.db.set !== 'function'
    ) {
        return false;
    }

    try {
        await client.db.set(
            getPanelStorageKey(guildId),
            {
                messageId: state.messageId,
                signature: state.signature,
                updatedAt: new Date().toISOString(),
            },
        );

        return true;
    } catch {
        return false;
    }
}

export async function createAbsenceRequest(
    client,
    guildId,
    user,
    reason,
    startDate,
    endDate,
) {
    const requests = await getAbsenceRequests(
        client,
        guildId,
    );

    const request = {
        id: `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`,

        guildId,

        userId: user.id,

        username: user.tag,

        reason,

        startDate,

        endDate,

        status: 'pending',

        createdAt: new Date().toISOString(),

        reviewedAt: null,

        reviewedBy: null,

        adminChannelId:
            ABSENCE_ADMIN_CHANNEL_ID,

        adminMessageId: null,
    };

    requests.push(request);

    const saved = await saveAbsenceRequests(
        client,
        guildId,
        requests,
    );

    if (!saved) {
        throw new Error(
            'Could not save absence request.',
        );
    }

    const adminChannel = await client.channels
        .fetch(ABSENCE_ADMIN_CHANNEL_ID)
        .catch(() => null);

    if (
        !adminChannel ||
        !adminChannel.isTextBased()
    ) {
        throw new Error(
            `Absence admin channel ${ABSENCE_ADMIN_CHANNEL_ID} could not be found.`,
        );
    }

    const adminMessage =
        await adminChannel.send(
            createAdminAbsenceMessage(request),
        );

    request.adminMessageId =
        adminMessage.id;

    await saveAbsenceRequests(
        client,
        guildId,
        requests,
    );

    return request;
}

export async function findAbsenceRequest(
    client,
    guildId,
    requestId,
) {
    const requests =
        await getAbsenceRequests(
            client,
            guildId,
        );

    return (
        requests.find(
            request =>
                request.id === requestId,
        ) ?? null
    );
}

export async function updateAbsenceRequest(
    client,
    guildId,
    requestId,
    updates,
) {
    const requests =
        await getAbsenceRequests(
            client,
            guildId,
        );

    const index =
        requests.findIndex(
            request =>
                request.id === requestId,
        );

    if (index === -1) {
        return null;
    }

    requests[index] = {
        ...requests[index],
        ...updates,
    };

    await saveAbsenceRequests(
        client,
        guildId,
        requests,
    );

    return requests[index];
}

export async function updateAdminAbsenceMessage(
    client,
    request,
) {
    if (
        !request?.adminChannelId ||
        !request?.adminMessageId
    ) {
        return false;
    }

    const channel =
        await client.channels
            .fetch(request.adminChannelId)
            .catch(() => null);

    if (
        !channel ||
        !channel.isTextBased()
    ) {
        return false;
    }

    const message =
        await channel.messages
            .fetch(request.adminMessageId)
            .catch(() => null);

    if (!message) {
        return false;
    }

    await message.edit(
        createAdminAbsenceMessage(request),
    );

    return true;
}

/**
 * Reconciles the public absence panel.
 *
 * IMPORTANT:
 *
 * This function does NOT edit the panel on every restart.
 *
 * Behaviour:
 *
 * 1. No saved panel:
 *    - Look for an existing matching panel.
 *    - If the existing panel already matches, save its state.
 *    - If it differs, send a new panel.
 *
 * 2. Saved panel exists and content has NOT changed:
 *    - Do nothing.
 *
 * 3. Saved panel exists and content HAS changed:
 *    - Send a NEW panel.
 *    - Do NOT edit the old panel.
 *    - Save the new panel as the canonical panel.
 *
 * 4. Saved panel was deleted:
 *    - Send a new panel.
 *
 * 5. Restart without configuration changes:
 *    - No edit.
 *    - No new message.
 */
export async function reconcileAbsencePanel(
    client,
) {
    try {
        if (
            !ABSENCE_PANEL_CHANNEL_ID ||
            ABSENCE_PANEL_CHANNEL_ID ===
                'PUT_PUBLIC_ABSENCE_PANEL_CHANNEL_ID_HERE'
        ) {
            return {
                action: 'error',
                error:
                    'ABSENCE_PANEL_CHANNEL_ID has not been configured.',
            };
        }

        const channel =
            await client.channels
                .fetch(
                    ABSENCE_PANEL_CHANNEL_ID,
                )
                .catch(() => null);

        if (
            !channel ||
            !channel.isTextBased()
        ) {
            return {
                action: 'error',
                error:
                    `Absence panel channel ${ABSENCE_PANEL_CHANNEL_ID} ` +
                    'could not be found or is not text based.',
            };
        }

        const guildId =
            channel.guildId;

        if (!guildId) {
            return {
                action: 'error',
                error:
                    'Could not determine the guild for the absence panel channel.',
            };
        }

        /*
         * Build the desired panel ONCE.
         */
        const panel =
            createAbsencePanel();

        const desiredSignature =
            getAbsencePanelSignature(
                panel,
            );

        /*
         * Load our saved canonical panel state.
         */
        const savedState =
            await getSavedPanelState(
                client,
                guildId,
            );

        /*
         * ---------------------------------------------------------
         * CASE 1:
         * We have a saved panel ID.
         * ---------------------------------------------------------
         */
        if (savedState?.messageId) {
            const existing =
                await channel.messages
                    .fetch(
                        savedState.messageId,
                    )
                    .catch(() => null);

            /*
             * The saved message was deleted.
             *
             * We need to create a replacement.
             */
            if (!existing) {
                const newMessage =
                    await channel.send(
                        panel,
                    );

                await savePanelState(
                    client,
                    guildId,
                    {
                        messageId:
                            newMessage.id,
                        signature:
                            desiredSignature,
                    },
                );

                return {
                    action: 'created',
                    reason: 'saved_panel_missing',
                    messageId:
                        newMessage.id,
                };
            }

            /*
             * The saved panel exists.
             *
             * IMPORTANT:
             *
             * Compare the actual current panel against
             * the desired panel as well as the saved signature.
             *
             * This protects against somebody manually editing
             * the panel in Discord.
             */
            const currentSignature =
                getMessagePanelSignature(
                    existing,
                );

            if (
                savedState.signature ===
                    desiredSignature &&
                currentSignature ===
                    desiredSignature
            ) {
                /*
                 * NOTHING CHANGED.
                 *
                 * Do not edit.
                 * Do not send.
                 */
                return {
                    action: 'unchanged',
                    messageId:
                        existing.id,
                };
            }

            /*
             * Something actually changed.
             *
             * Send a NEW panel instead of editing the
             * previous one.
             */
            const newMessage =
                await channel.send(
                    panel,
                );

            await savePanelState(
                client,
                guildId,
                {
                    messageId:
                        newMessage.id,
                    signature:
                        desiredSignature,
                },
            );

            return {
                action: 'created',
                reason: 'panel_changed',
                oldMessageId:
                    existing.id,
                messageId:
                    newMessage.id,
            };
        }

        /*
         * ---------------------------------------------------------
         * CASE 2:
         * No saved panel state exists.
         *
         * This can happen if:
         * - This is the first startup.
         * - The database was reset.
         * - The bot was updated before panel state was stored.
         *
         * We check existing messages before creating anything.
         * ---------------------------------------------------------
         */

        const messages =
            await channel.messages.fetch({
                limit: 50,
            });

        const existingPanels =
            messages.filter(
                message => {
                    if (
                        message.author?.id !==
                        client.user?.id
                    ) {
                        return false;
                    }

                    return message.embeds?.some(
                        embed =>
                            embed.title?.includes(
                                'Fruity Absence',
                            ),
                    );
                },
            );

        /*
         * Check whether one of the existing panels already
         * matches our desired configuration.
         */
        const matchingPanel =
            existingPanels.find(
                message =>
                    getMessagePanelSignature(
                        message,
                    ) ===
                    desiredSignature,
            );

        if (matchingPanel) {
            /*
             * Existing panel is already correct.
             *
             * Save its state so future restarts can
             * immediately determine that nothing changed.
             */
            await savePanelState(
                client,
                guildId,
                {
                    messageId:
                        matchingPanel.id,
                    signature:
                        desiredSignature,
                },
            );

            return {
                action: 'unchanged',
                reason:
                    'existing_panel_matches',
                messageId:
                    matchingPanel.id,
            };
        }

        /*
         * We found a bot-created Fruity Absence panel,
         * but its contents are different.
         *
         * Create a NEW panel.
         */
        if (existingPanels.size > 0) {
            const newMessage =
                await channel.send(
                    panel,
                );

            await savePanelState(
                client,
                guildId,
                {
                    messageId:
                        newMessage.id,
                    signature:
                        desiredSignature,
                },
            );

            return {
                action: 'created',
                reason:
                    'existing_panel_changed',
                messageId:
                    newMessage.id,
            };
        }

        /*
         * No previous panel exists at all.
         *
         * First creation.
         */
        const message =
            await channel.send(panel);

        await savePanelState(
            client,
            guildId,
            {
                messageId:
                    message.id,
                signature:
                    desiredSignature,
            },
        );

        return {
            action: 'created',
            reason: 'first_panel',
            messageId:
                message.id,
        };
    } catch (error) {
        return {
            action: 'error',
            error:
                error?.message ??
                String(error),
        };
    }
}

/**
 * Converts an existing Discord message into the same
 * signature format used by createAbsencePanel().
 *
 * This lets us detect manual changes to the actual Discord
 * message even if our database still contains the old signature.
 */
function getMessagePanelSignature(
    message,
) {
    return stableStringify({
        embeds:
            message.embeds?.map(
                embed => {
                    if (
                        typeof embed?.toJSON ===
                        'function'
                    ) {
                        return embed.toJSON();
                    }

                    return embed;
                },
            ) ?? [],

        components:
            message.components?.map(
                component => {
                    if (
                        typeof component?.toJSON ===
                        'function'
                    ) {
                        return component.toJSON();
                    }

                    return component;
                },
            ) ?? [],
    });
}

export {
    ABSENCE_PANEL_CHANNEL_ID,
    ABSENCE_ADMIN_CHANNEL_ID,
};
