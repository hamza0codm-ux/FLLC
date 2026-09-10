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

function getStorageKey(guildId) {
    return `${STORAGE_PREFIX}${guildId}${STORAGE_SUFFIX}`;
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
            'Submit an absence request or check your current request status below.'
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
            `**From:** <@${request.userId}>`
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
    if (!client?.db || typeof client.db.get !== 'function') {
        return [];
    }

    try {
        const raw = await client.db.get(
            getStorageKey(guildId),
            [],
        );

        const requests = unwrap(raw);

        return Array.isArray(requests) ? requests : [];
    } catch {
        return [];
    }
}

export async function saveAbsenceRequests(client, guildId, requests) {
    if (!client?.db || typeof client.db.set !== 'function') {
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

export async function createAbsenceRequest(
    client,
    guildId,
    user,
    reason,
    startDate,
    endDate,
) {
    const requests = await getAbsenceRequests(client, guildId);

    const request = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
        adminChannelId: ABSENCE_ADMIN_CHANNEL_ID,
        adminMessageId: null,
    };

    requests.push(request);

    const saved = await saveAbsenceRequests(
        client,
        guildId,
        requests,
    );

    if (!saved) {
        throw new Error('Could not save absence request.');
    }

    const adminChannel = await client.channels
        .fetch(ABSENCE_ADMIN_CHANNEL_ID)
        .catch(() => null);

    if (!adminChannel || !adminChannel.isTextBased()) {
        throw new Error(
            `Absence admin channel ${ABSENCE_ADMIN_CHANNEL_ID} could not be found.`,
        );
    }

    const adminMessage = await adminChannel.send(
        createAdminAbsenceMessage(request),
    );

    request.adminMessageId = adminMessage.id;

    await saveAbsenceRequests(client, guildId, requests);

    return request;
}

export async function findAbsenceRequest(
    client,
    guildId,
    requestId,
) {
    const requests = await getAbsenceRequests(
        client,
        guildId,
    );

    return requests.find(
        request => request.id === requestId,
    ) ?? null;
}

export async function updateAbsenceRequest(
    client,
    guildId,
    requestId,
    updates,
) {
    const requests = await getAbsenceRequests(
        client,
        guildId,
    );

    const index = requests.findIndex(
        request => request.id === requestId,
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
    if (!request?.adminChannelId || !request?.adminMessageId) {
        return false;
    }

    const channel = await client.channels
        .fetch(request.adminChannelId)
        .catch(() => null);

    if (!channel || !channel.isTextBased()) {
        return false;
    }

    const message = await channel.messages
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

export async function reconcileAbsencePanel(client) {
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

        const channel = await client.channels
            .fetch(ABSENCE_PANEL_CHANNEL_ID)
            .catch(() => null);

        if (!channel || !channel.isTextBased()) {
            return {
                action: 'error',
                error:
                    `Absence panel channel ${ABSENCE_PANEL_CHANNEL_ID} ` +
                    'could not be found or is not text based.',
            };
        }

        const messages = await channel.messages.fetch({
            limit: 20,
        });

        const existing = messages.find(message => {
            if (message.author?.id !== client.user?.id) {
                return false;
            }

            return message.embeds?.some(embed =>
                embed.title?.includes('Fruity Absence'),
            );
        });

        const panel = createAbsencePanel();

        if (existing) {
            await existing.edit(panel);

            return {
                action: 'unchanged',
                messageId: existing.id,
            };
        }

        const message = await channel.send(panel);

        return {
            action: 'created',
            messageId: message.id,
        };
    } catch (error) {
        return {
            action: 'error',
            error: error?.message ?? String(error),
        };
    }
}

export {
    ABSENCE_PANEL_CHANNEL_ID,
    ABSENCE_ADMIN_CHANNEL_ID,
};
