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
const PANEL_STORAGE_SUFFIX = ':absence:panel';

function getStorageKey(guildId) {
    return `${STORAGE_PREFIX}${guildId}${STORAGE_SUFFIX}`;
}

function getPanelStorageKey(guildId) {
    return `${STORAGE_PREFIX}${guildId}${PANEL_STORAGE_SUFFIX}`;
}

function unwrap(value) {
    if (
        value &&
        typeof value === 'object' &&
        value.value !== undefined &&
        value.ok !== undefined
    ) {
        return unwrap(value.value);
    }

    return value;
}

/*
|--------------------------------------------------------------------------
| ABSENCE PANEL CONFIGURATION
|--------------------------------------------------------------------------
|
| IMPORTANT:
| This object represents the actual configuration of the panel.
|
| The restart detector uses THIS configuration instead of comparing
| Discord's returned embed/component JSON.
|
| If you change anything here, a new panel is created.
|
*/

const ABSENCE_PANEL_CONFIG = {
    title: `${EMOJIS.vacation} Fruity Absence`,

    description:
        'Submit an absence request below.',

    color: ABSENCE_COLOR,

    button: {
        customId: 'absence',
        label: 'Absence',
        style: ButtonStyle.Secondary,
        emojiName: 'Vacation',
        emojiId: '1547149550404239370',
    },
};

/*
|--------------------------------------------------------------------------
| CONFIG SIGNATURE
|--------------------------------------------------------------------------
|
| This is deliberately based ONLY on our configuration.
|
| Discord is allowed to normalize the actual message payload without
| causing a false "configuration changed" detection.
|
*/

function getAbsencePanelConfigSignature() {
    return JSON.stringify({
        channelId: ABSENCE_PANEL_CHANNEL_ID,

        title: ABSENCE_PANEL_CONFIG.title,

        description:
            ABSENCE_PANEL_CONFIG.description,

        color:
            ABSENCE_PANEL_CONFIG.color,

        button: {
            customId:
                ABSENCE_PANEL_CONFIG.button.customId,

            label:
                ABSENCE_PANEL_CONFIG.button.label,

            style:
                ABSENCE_PANEL_CONFIG.button.style,

            emojiName:
                ABSENCE_PANEL_CONFIG.button.emojiName,

            emojiId:
                ABSENCE_PANEL_CONFIG.button.emojiId,
        },
    });
}

/*
|--------------------------------------------------------------------------
| PUBLIC PANEL
|--------------------------------------------------------------------------
*/

export function createAbsencePanel() {
    const embed = new EmbedBuilder()
        .setColor(
            ABSENCE_PANEL_CONFIG.color,
        )
        .setTitle(
            ABSENCE_PANEL_CONFIG.title,
        )
        .setDescription(
            ABSENCE_PANEL_CONFIG.description,
        );

    const button = new ButtonBuilder()
        .setCustomId(
            ABSENCE_PANEL_CONFIG.button.customId,
        )
        .setLabel(
            ABSENCE_PANEL_CONFIG.button.label,
        )
        .setStyle(
            ABSENCE_PANEL_CONFIG.button.style,
        )
        .setEmoji({
            name:
                ABSENCE_PANEL_CONFIG.button.emojiName,
            id:
                ABSENCE_PANEL_CONFIG.button.emojiId,
        });

    return {
        embeds: [embed],

        components: [
            new ActionRowBuilder().addComponents(
                button,
            ),
        ],
    };
}

/*
|--------------------------------------------------------------------------
| ADMIN ABSENCE MESSAGE
|--------------------------------------------------------------------------
*/

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
                    .setCustomId(
                        `absence_approve:${request.id}`,
                    )
                    .setEmoji({
                        name: 'Yes',
                        id: '1545795445043888239',
                    })
                    .setLabel('Approve')
                    .setStyle(
                        ButtonStyle.Success,
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `absence_deny:${request.id}`,
                    )
                    .setEmoji({
                        name: 'No',
                        id: '1545795160586190858',
                    })
                    .setLabel('Deny')
                    .setStyle(
                        ButtonStyle.Danger,
                    ),
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

/*
|--------------------------------------------------------------------------
| ABSENCE REQUEST STORAGE
|--------------------------------------------------------------------------
*/

export async function getAbsenceRequests(
    client,
    guildId,
) {
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

/*
|--------------------------------------------------------------------------
| CREATE ABSENCE REQUEST
|--------------------------------------------------------------------------
*/

export async function createAbsenceRequest(
    client,
    guildId,
    user,
    reason,
    startDate,
    endDate,
) {
    const requests =
        await getAbsenceRequests(
            client,
            guildId,
        );

    const request = {
        id:
            `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,

        guildId,

        userId: user.id,

        username: user.tag,

        reason,

        startDate,

        endDate,

        status: 'pending',

        createdAt:
            new Date().toISOString(),

        reviewedAt: null,

        reviewedBy: null,

        adminChannelId:
            ABSENCE_ADMIN_CHANNEL_ID,

        adminMessageId: null,
    };

    requests.push(request);

    const saved =
        await saveAbsenceRequests(
            client,
            guildId,
            requests,
        );

    if (!saved) {
        throw new Error(
            'Could not save absence request.',
        );
    }

    const adminChannel =
        await client.channels
            .fetch(
                ABSENCE_ADMIN_CHANNEL_ID,
            )
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
            createAdminAbsenceMessage(
                request,
            ),
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

/*
|--------------------------------------------------------------------------
| FIND ABSENCE REQUEST
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| UPDATE ABSENCE REQUEST
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| UPDATE ADMIN MESSAGE
|--------------------------------------------------------------------------
*/

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
            .fetch(
                request.adminChannelId,
            )
            .catch(() => null);

    if (
        !channel ||
        !channel.isTextBased()
    ) {
        return false;
    }

    const message =
        await channel.messages
            .fetch(
                request.adminMessageId,
            )
            .catch(() => null);

    if (!message) {
        return false;
    }

    await message.edit(
        createAdminAbsenceMessage(
            request,
        ),
    );

    return true;
}

/*
|--------------------------------------------------------------------------
| PANEL STATE
|--------------------------------------------------------------------------
*/

async function getSavedPanelState(
    client,
    guildId,
) {
    if (
        !client?.db ||
        typeof client.db.get !== 'function'
    ) {
        return null;
    }

    try {
        const raw =
            await client.db.get(
                getPanelStorageKey(
                    guildId,
                ),
                null,
            );

        const state = unwrap(raw);

        if (
            !state ||
            typeof state !== 'object'
        ) {
            return null;
        }

        return state;
    } catch {
        return null;
    }
}

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
            getPanelStorageKey(
                guildId,
            ),
            state,
        );

        return true;
    } catch {
        return false;
    }
}

/*
|--------------------------------------------------------------------------
| FIND EXISTING FRUITY ABSENCE PANEL
|--------------------------------------------------------------------------
|
| This is only used when there is no saved state.
|
*/

async function findExistingAbsencePanel(
    client,
    channel,
) {
    try {
        const messages =
            await channel.messages.fetch({
                limit: 100,
            });

        return (
            messages.find(message => {
                if (
                    message.author?.id !==
                    client.user?.id
                ) {
                    return false;
                }

                return message.embeds?.some(
                    embed =>
                        embed.title ===
                        ABSENCE_PANEL_CONFIG.title,
                );
            }) ?? null
        );
    } catch {
        return null;
    }
}

/*
|--------------------------------------------------------------------------
| RECONCILE ABSENCE PANEL
|--------------------------------------------------------------------------
|
| EXACT BEHAVIOUR:
|
| FIRST STARTUP
| -> Create panel.
|
| RESTART WITHOUT CHANGES
| -> Do NOTHING.
|
| CHANGE PANEL CONFIG
| -> Create ONE new panel.
|
| RESTART AFTER CHANGE
| -> Do NOTHING.
|
| PANEL MANUALLY DELETED
| -> Create replacement.
|
| IMPORTANT:
| We NEVER edit an existing public absence panel.
|
*/

export async function reconcileAbsencePanel(
    client,
) {
    try {
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
                    `Absence panel channel ${ABSENCE_PANEL_CHANNEL_ID} could not be found or is not text based.`,
            };
        }

        const guildId =
            channel.guild?.id;

        if (!guildId) {
            return {
                action: 'error',

                error:
                    'Could not determine the guild ID for the absence panel channel.',
            };
        }

        const currentSignature =
            getAbsencePanelConfigSignature();

        const savedState =
            await getSavedPanelState(
                client,
                guildId,
            );

        /*
        |--------------------------------------------------------------------------
        | SAVED STATE EXISTS
        |--------------------------------------------------------------------------
        */

        if (savedState?.messageId) {
            const savedMessage =
                await channel.messages
                    .fetch(
                        savedState.messageId,
                    )
                    .catch(() => null);

            /*
             * The panel was manually deleted.
             *
             * We need to recreate it.
             */
            if (!savedMessage) {
                const replacement =
                    await channel.send(
                        createAbsencePanel(),
                    );

                await savePanelState(
                    client,
                    guildId,
                    {
                        messageId:
                            replacement.id,

                        configSignature:
                            currentSignature,
                    },
                );

                return {
                    action: 'created',

                    reason: 'missing',

                    messageId:
                        replacement.id,
                };
            }

            /*
            |--------------------------------------------------------------------------
            | CONFIGURATION HAS NOT CHANGED
            |--------------------------------------------------------------------------
            |
            | This is the key part.
            |
            | We ONLY compare the stored configuration
            | signature against the current configuration.
            |
            | We do NOT compare Discord's message JSON.
            |
            | Therefore a restart cannot create another
            | panel simply because Discord normalized the
            | embed/component payload.
            |
            */

            if (
                savedState.configSignature ===
                currentSignature
            ) {
                return {
                    action: 'unchanged',

                    messageId:
                        savedMessage.id,
                };
            }

            /*
            |--------------------------------------------------------------------------
            | CONFIGURATION CHANGED
            |--------------------------------------------------------------------------
            |
            | Create a NEW panel.
            |
            | Do NOT edit the old one.
            |
            */

            const changedMessage =
                await channel.send(
                    createAbsencePanel(),
                );

            await savePanelState(
                client,
                guildId,
                {
                    messageId:
                        changedMessage.id,

                    configSignature:
                        currentSignature,
                },
            );

            return {
                action: 'created',

                reason: 'changed',

                messageId:
                    changedMessage.id,
            };
        }

        /*
        |--------------------------------------------------------------------------
        | NO SAVED STATE
        |--------------------------------------------------------------------------
        |
        | This can happen once when upgrading from the
        | previous absenceService.js.
        |
        | Search for an existing Fruity Absence panel
        | before creating anything.
        |
        */

        const existingPanel =
            await findExistingAbsencePanel(
                client,
                channel,
            );

        if (existingPanel) {
            /*
             * Adopt the existing panel instead of
             * creating another one.
             *
             * This is especially important for the
             * first restart after installing this version.
             */

            await savePanelState(
                client,
                guildId,
                {
                    messageId:
                        existingPanel.id,

                    configSignature:
                        currentSignature,
                },
            );

            return {
                action: 'unchanged',

                messageId:
                    existingPanel.id,
            };
        }

        /*
        |--------------------------------------------------------------------------
        | NOTHING EXISTS
        |--------------------------------------------------------------------------
        |
        | First-ever startup.
        |
        */

        const message =
            await channel.send(
                createAbsencePanel(),
            );

        await savePanelState(
            client,
            guildId,
            {
                messageId:
                    message.id,

                configSignature:
                    currentSignature,
            },
        );

        return {
            action: 'created',

            reason: 'initial',

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

export {
    ABSENCE_PANEL_CONFIG,
    ABSENCE_PANEL_CHANNEL_ID,
    ABSENCE_ADMIN_CHANNEL_ID,
};
