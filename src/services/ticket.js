// src/services/ticket.js

import {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits,
} from 'discord.js';

import {
    buildStandardLogEmbed,
    formatLogLine,
} from '../utils/logging/logEmbeds.js';

import {
    getGuildConfig,
} from './config/guildConfig.js';

import {
    getTicketData,
    saveTicketData,
    deleteTicketData,
    getOpenTicketCountForUser,
    incrementTicketCounter,
} from '../utils/database.js';

import {
    logger,
} from '../utils/logger.js';

import {
    createEmbed,
} from '../utils/embeds.js';

import {
    logTicketEvent,
} from '../utils/ticket/ticketLogging.js';

import {
    createError,
    ErrorTypes,
} from '../utils/errorHandler.js';

import {
    ensureTypedServiceError,
    wrapServiceBoundary,
} from '../utils/serviceErrorBoundary.js';

import {
    PRIORITY_MAP,
} from '../utils/helpers.js';


const TICKET_DELETE_DELAY_MS = 3000;

const TICKET_SERVICE = 'ticketService';

const OPEN_STATUS =
    '<a:Open:1546505803177922660> Open';

const CLOSED_STATUS =
    '<a:Closed:1546505857486028871> Closed';

const AUTO_HIGH_PRIORITY_ROLE_IDS = [
    '1545924982025093260',
    '1545924979420303522',
    '1546478149687316510',
];

const DEFAULT_TEAM_TEXT =
    'The Fruity Support Team will assist you shortly,\n' +
    'In the meantime please provide your request and information to speed up the process,\n' +
    'We ask you to not ping our staff whilst this ticket is open.';


function ticketUserError(
    message,
    userMessage,
    type = ErrorTypes.VALIDATION,
    context = {}
) {
    throw createError(
        message,
        type,
        userMessage,
        {
            service: TICKET_SERVICE,
            ...context,
        }
    );
}


function requireTicket(
    ticketData,
    channel
) {
    if (!ticketData) {
        ticketUserError(
            'Not a ticket channel',
            'This is not a ticket channel.',
            ErrorTypes.VALIDATION,
            {
                channelId: channel?.id,
                guildId: channel?.guild?.id,
            }
        );
    }

    return ticketData;
}


function rethrowTicketError(
    error,
    operation,
    userMessage,
    context = {}
) {
    throw ensureTypedServiceError(
        error,
        {
            service: TICKET_SERVICE,
            operation,
            message:
                `Ticket operation failed: ${operation}`,
            userMessage,
            context,
        }
    );
}


/*
|--------------------------------------------------------------------------
| Name Helpers
|--------------------------------------------------------------------------
*/

function cleanNamePart(
    value,
    fallback = 'ticket'
) {
    const cleaned =
        String(value || fallback)
            .toLowerCase()
            .normalize('NFKD')
            .replace(
                /[\u0300-\u036f]/g,
                ''
            )
            .replace(
                /[^a-z0-9]+/g,
                '-'
            )
            .replace(
                /^-+|-+$/g,
                ''
            )
            .replace(
                /-{2,}/g,
                '-'
            )
            .slice(
                0,
                70
            );

    return cleaned || fallback;
}


function stripPriorityPrefix(
    channelName
) {
    let result =
        String(
            channelName || ''
        ).trim();

    const emojis =
        [
            ...new Set(
                Object.values(
                    PRIORITY_MAP
                )
                    .map(
                        item =>
                            item?.emoji
                    )
                    .filter(Boolean)
            ),
        ].sort(
            (a, b) =>
                b.length - a.length
        );

    for (const emoji of emojis) {
        if (
            result.startsWith(
                `${emoji}-`
            )
        ) {
            result =
                result.slice(
                    `${emoji}-`.length
                );
            break;
        }

        if (
            result.startsWith(
                `${emoji} `
            )
        ) {
            result =
                result.slice(
                    `${emoji} `.length
                );
            break;
        }

        if (
            result.startsWith(
                emoji
            )
        ) {
            result =
                result
                    .slice(emoji.length)
                    .replace(
                        /^[-\s]+/,
                        ''
                    );
            break;
        }
    }

    return result || 'ticket';
}


function getPriorityInfo(
    priority
) {
    return (
        PRIORITY_MAP[priority] ||
        PRIORITY_MAP.none || {
            emoji: '',
            label: 'None',
            color: 0x95a5a6,
        }
    );
}


function getPriorityDisplay(
    priority
) {
    const info =
        getPriorityInfo(
            priority
        );

    if (
        priority === 'none' ||
        !info.emoji
    ) {
        return info.label || 'None';
    }

    return `${info.emoji} ${info.label}`;
}


function applyPriorityToChannelName(
    baseName,
    priority
) {
    const cleanBase =
        stripPriorityPrefix(
            baseName
        );

    if (
        !priority ||
        priority === 'none'
    ) {
        return cleanBase;
    }

    const info =
        getPriorityInfo(
            priority
        );

    if (!info?.emoji) {
        return cleanBase;
    }

    return `${info.emoji}-${cleanBase}`;
}


function memberHasAutoHighRole(
    member
) {
    return AUTO_HIGH_PRIORITY_ROLE_IDS.some(
        roleId =>
            member?.roles?.cache?.has(
                roleId
            )
    );
}


function makeBaseTicketName(
    ticketType,
    member
) {
    const typePart =
        cleanNamePart(
            ticketType,
            'ticket'
        );

    const usernamePart =
        cleanNamePart(
            member?.user?.username ||
            member?.displayName ||
            'user',
            'user'
        );

    return `${typePart}-${usernamePart}`;
}


async function getAvailableTicketName(
    guild,
    ticketType,
    member,
    priority
) {
    const base =
        makeBaseTicketName(
            ticketType,
            member
        );

    const existingNames =
        new Set(
            guild.channels.cache.map(
                channel =>
                    stripPriorityPrefix(
                        channel.name
                    )
            )
        );

    let candidate = base;
    let number = 2;

    while (
        existingNames.has(
            candidate
        )
    ) {
        candidate =
            `${base}-${number}`;

        number++;
    }

    return applyPriorityToChannelName(
        candidate.slice(0, 90),
        priority
    );
}


/*
|--------------------------------------------------------------------------
| Ticket Embed
|--------------------------------------------------------------------------
*/

function buildMainTicketEmbed(
    ticketData
) {
    const priorityInfo =
        getPriorityInfo(
            ticketData.priority
        );

    const claimedBy =
        ticketData.claimedBy
            ? `<@${ticketData.claimedBy}>`
            : 'Not claimed';

    const status =
        ticketData.status === 'closed'
            ? CLOSED_STATUS
            : OPEN_STATUS;

    const ticketType =
        ticketData.ticketType ||
        ticketData.ticketTypeKey ||
        'Support';

    const teamText =
        ticketData.teamText ||
        DEFAULT_TEAM_TEXT;

    return createEmbed({
        title:
            `${ticketType} Ticket`,

        description:
            `<@${ticketData.userId}>, thank you for opening a ticket.\n\n` +

            `**Ticket Type:** ${ticketType}\n` +
            `**Reason:** ${ticketData.reason || 'No reason provided'}\n` +
            `**Priority:** ${getPriorityDisplay(ticketData.priority)}\n` +
            `**Status:** ${status}\n` +
            `**Claimed By:** ${claimedBy}\n\n` +

            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +

            teamText,

        color:
            priorityInfo?.color ||
            0xF8D568,

        footer: {
            text:
                `Ticket ID: ${ticketData.id}`,
        },
    });
}


/*
|--------------------------------------------------------------------------
| Ticket Controls
|--------------------------------------------------------------------------
|
| PIN IS REMOVED.
| PRIORITY REPLACES PIN.
|
*/

function buildTicketControlRow({
    claimedBy = null,
} = {}) {
    return new ActionRowBuilder()
        .addComponents(

            new ButtonBuilder()
                .setCustomId(
                    'ticket_claim'
                )
                .setLabel(
                    claimedBy
                        ? 'Claimed'
                        : 'Claim'
                )
                .setStyle(
                    claimedBy
                        ? ButtonStyle.Secondary
                        : ButtonStyle.Primary
                )
                .setEmoji('🙋')
                .setDisabled(
                    Boolean(
                        claimedBy
                    )
                ),

            new ButtonBuilder()
                .setCustomId(
                    'ticket_priority'
                )
                .setLabel(
                    'Priority'
                )
                .setStyle(
                    ButtonStyle.Secondary
                )
                .setEmoji('💼'),

            new ButtonBuilder()
                .setCustomId(
                    'ticket_close'
                )
                .setLabel(
                    'Close'
                )
                .setStyle(
                    ButtonStyle.Danger
                )
                .setEmoji('🔒')
        );
}


async function getMainTicketMessage(
    channel,
    ticketData
) {
    if (
        ticketData?.ticketMessageId
    ) {
        const direct =
            await channel.messages.fetch(
                ticketData.ticketMessageId
            ).catch(
                () => null
            );

        if (direct) {
            return direct;
        }
    }

    const messages =
        await channel.messages.fetch({
            limit: 100,
        });

    return (
        messages.find(
            message =>
                message.author?.id ===
                    channel.client.user?.id &&
                message.embeds?.length > 0 &&
                (
                    message.embeds[0]?.footer?.text ===
                        `Ticket ID: ${ticketData.id}` ||

                    message.embeds[0]?.title?.startsWith(
                        'Ticket #'
                    ) ||

                    message.embeds[0]?.title?.endsWith(
                        ' Ticket'
                    )
                )
        ) || null
    );
}


async function refreshMainTicketMessage(
    channel,
    ticketData,
    {
        components = true,
    } = {}
) {
    const ticketMessage =
        await getMainTicketMessage(
            channel,
            ticketData
        );

    if (!ticketMessage) {
        return null;
    }

    const payload = {
        embeds: [
            buildMainTicketEmbed(
                ticketData
            ),
        ],
    };

    payload.components =
        components
            ? [
                buildTicketControlRow({
                    claimedBy:
                        ticketData.claimedBy,
                }),
            ]
            : [];

    await ticketMessage.edit(
        payload
    );

    return ticketMessage;
}


/*
|--------------------------------------------------------------------------
| Ticket Count
|--------------------------------------------------------------------------
*/

export const getUserTicketCount =
    wrapServiceBoundary(
        async function getUserTicketCount(
            guildId,
            userId
        ) {
            return await getOpenTicketCountForUser(
                guildId,
                userId
            );
        },
        {
            service:
                TICKET_SERVICE,
            operation:
                'getUserTicketCount',
            userMessage:
                'Failed to count open tickets.',
            context: {},
        }
    );


/*
|--------------------------------------------------------------------------
| CREATE TICKET
|--------------------------------------------------------------------------
*/

export async function createTicket(
    guild,
    member,
    categoryId,
    reason = 'No reason provided',
    priority = 'none',
    options = {}
) {
    try {
        const config =
            await getGuildConfig(
                guild.client,
                guild.id
            );

        const maxTicketsPerUser =
            config.maxTicketsPerUser ?? 3;

        const currentTicketCount =
            await getUserTicketCount(
                guild.id,
                member.id
            );

        if (
            currentTicketCount >=
            maxTicketsPerUser
        ) {
            ticketUserError(
                `Max open tickets reached for ${member.id}`,
                `You have reached the maximum number of open tickets (${maxTicketsPerUser}). Please close your existing tickets before creating a new one.`,
                ErrorTypes.VALIDATION,
                {
                    guildId:
                        guild.id,
                    userId:
                        member.id,
                }
            );
        }

        let category =
            categoryId
                ? guild.channels.cache.get(
                    categoryId
                )
                : null;

        if (
            !category &&
            categoryId
        ) {
            category =
                await guild.channels.fetch(
                    categoryId
                ).catch(
                    () => null
                );
        }

        if (
            !category &&
            !categoryId
        ) {
            category =
                guild.channels.cache.find(
                    channel =>
                        channel.type ===
                            ChannelType.GuildCategory &&
                        channel.name
                            .toLowerCase()
                            .includes(
                                'ticket'
                            )
                );
        }

        /*
        |--------------------------------------------------------------------------
        | Automatic High Priority
        |--------------------------------------------------------------------------
        */

        let resolvedPriority =
            PRIORITY_MAP[priority]
                ? priority
                : 'none';

        if (
            memberHasAutoHighRole(
                member
            )
        ) {
            resolvedPriority =
                'high';
        }

        /*
        |--------------------------------------------------------------------------
        | Button / Ticket Type
        |--------------------------------------------------------------------------
        */

        const ticketType =
            options.ticketType ||
            options.ticketTypeKey ||
            'ticket';

        /*
        |--------------------------------------------------------------------------
        | Name:
        | button-name-username
        | button-name-username-2
        | button-name-username-3
        |--------------------------------------------------------------------------
        */

        const channelName =
            await getAvailableTicketName(
                guild,
                ticketType,
                member,
                resolvedPriority
            );

        const staffRoleId =
            options.staffRoleId ||
            config.ticketStaffRoleId ||
            null;

        const permissionOverwrites = [
            {
                id:
                    guild.id,
                deny: [
                    PermissionFlagsBits.ViewChannel,
                ],
            },

            {
                id:
                    member.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.ReadMessageHistory,
                ],
            },
        ];

        if (staffRoleId) {
            permissionOverwrites.push({
                id:
                    staffRoleId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.ManageMessages,
                ],
            });
        }

        const channel =
            await guild.channels.create({
                name:
                    channelName,

                type:
                    ChannelType.GuildText,

                parent:
                    category?.id ||
                    categoryId ||
                    undefined,

                permissionOverwrites,
            });

        const ticketNumber =
            await incrementTicketCounter(
                guild.id
            );

        const ticketData = {
            id:
                channel.id,

            channelId:
                channel.id,

            ticketNumber,

            guildId:
                guild.id,

            userId:
                member.id,

            panelType:
                options.panelType ||
                null,

            ticketType:
                options.ticketType ||
                ticketType,

            ticketTypeKey:
                options.ticketTypeKey ||
                null,

            ticketName:
                options.ticketType ||
                ticketType,

            reason,

            priority:
                resolvedPriority,

            status:
                'open',

            claimedBy:
                null,

            claimedAt:
                null,

            staffRoleId,

            categoryId:
                category?.id ||
                categoryId ||
                null,

            ticketLogsChannelId:
                options.ticketLogsChannelId ||
                null,

            transcriptLogsChannelId:
                options.transcriptLogsChannelId ||
                null,

            reviewLogsChannelId:
                options.reviewLogsChannelId ||
                null,

            teamText:
                options.teamText ||
                DEFAULT_TEAM_TEXT,

            createdAt:
                new Date().toISOString(),
        };

        await saveTicketData(
            guild.id,
            channel.id,
            ticketData
        );

        const staffMention =
            staffRoleId
                ? ` <@&${staffRoleId}>`
                : '';

        const ticketMessage =
            await channel.send({
                content:
                    `${member}${staffMention}`,

                embeds: [
                    buildMainTicketEmbed(
                        ticketData
                    ),
                ],

                components: [
                    buildTicketControlRow(),
                ],

                allowedMentions: {
                    users: [
                        member.id,
                    ],

                    roles:
                        staffRoleId
                            ? [
                                staffRoleId,
                            ]
                            : [],
                },
            });

        ticketData.ticketMessageId =
            ticketMessage.id;

        await saveTicketData(
            guild.id,
            channel.id,
            ticketData
        );

        await logTicketEvent({
            client:
                guild.client,

            guildId:
                guild.id,

            event: {
                type:
                    'open',

                ticketId:
                    channel.id,

                ticketNumber,

                userId:
                    member.id,

                executorId:
                    member.id,

                reason,

                priority:
                    resolvedPriority,

                metadata: {
                    channelId:
                        channel.id,

                    panelType:
                        ticketData.panelType,

                    ticketType:
                        ticketData.ticketType,
                },
            },
        }).catch(
            () => null
        );

        return {
            channel,
            ticketData,
        };

    } catch (error) {
        rethrowTicketError(
            error,
            'createTicket',
            'Failed to create ticket. Please try again in a moment.',
            {
                guildId:
                    guild?.id,
                userId:
                    member?.id,
            }
        );
    }
}


/*
|--------------------------------------------------------------------------
| CLAIM
|--------------------------------------------------------------------------
*/

export async function claimTicket(
    channel,
    claimer
) {
    try {
        const ticketData =
            requireTicket(
                await getTicketData(
                    channel.guild.id,
                    channel.id
                ),
                channel
            );

        if (
            ticketData.claimedBy
        ) {
            ticketUserError(
                'Ticket already claimed',
                `This ticket is already claimed by <@${ticketData.claimedBy}>`,
                ErrorTypes.VALIDATION
            );
        }

        ticketData.claimedBy =
            claimer.id;

        ticketData.claimedAt =
            new Date().toISOString();

        await saveTicketData(
            channel.guild.id,
            channel.id,
            ticketData
        );

        await refreshMainTicketMessage(
            channel,
            ticketData
        );

        await logTicketEvent({
            client:
                channel.client,

            guildId:
                channel.guild.id,

            event: {
                type:
                    'claim',

                ticketId:
                    channel.id,

                ticketNumber:
                    ticketData.ticketNumber ||
                    ticketData.id,

                userId:
                    ticketData.userId,

                executorId:
                    claimer.id,
            },
        }).catch(
            () => null
        );

        return ticketData;

    } catch (error) {
        rethrowTicketError(
            error,
            'claimTicket',
            'Failed to claim ticket.',
            {
                guildId:
                    channel?.guild?.id,
                channelId:
                    channel?.id,
                claimerId:
                    claimer?.id,
            }
        );
    }
}


/*
|--------------------------------------------------------------------------
| UNCLAIM
|--------------------------------------------------------------------------
*/

export async function unclaimTicket(
    channel,
    unclaimer
) {
    try {
        const ticketData =
            requireTicket(
                await getTicketData(
                    channel.guild.id,
                    channel.id
                ),
                channel
            );

        if (
            !ticketData.claimedBy
        ) {
            ticketUserError(
                'Ticket not claimed',
                'This ticket is not currently claimed.'
            );
        }

        if (
            ticketData.claimedBy !==
                unclaimer.id &&
            !unclaimer.permissions.has(
                PermissionFlagsBits.ManageChannels
            )
        ) {
            ticketUserError(
                'Cannot unclaim ticket',
                'You can only unclaim your own tickets or need Manage Channels permission.',
                ErrorTypes.PERMISSION
            );
        }

        const previousClaimer =
            ticketData.claimedBy;

        ticketData.claimedBy =
            null;

        ticketData.claimedAt =
            null;

        await saveTicketData(
            channel.guild.id,
            channel.id,
            ticketData
        );

        await refreshMainTicketMessage(
            channel,
            ticketData
        );

        await logTicketEvent({
            client:
                channel.client,

            guildId:
                channel.guild.id,

            event: {
                type:
                    'unclaim',

                ticketId:
                    channel.id,

                ticketNumber:
                    ticketData.ticketNumber ||
                    ticketData.id,

                userId:
                    ticketData.userId,

                executorId:
                    unclaimer.id,

                metadata: {
                    previousClaimer,
                },
            },
        }).catch(
            () => null
        );

        return ticketData;

    } catch (error) {
        rethrowTicketError(
            error,
            'unclaimTicket',
            'Failed to unclaim ticket.',
            {
                guildId:
                    channel?.guild?.id,
                channelId:
                    channel?.id,
                unclaimerId:
                    unclaimer?.id,
            }
        );
    }
}


/*
|--------------------------------------------------------------------------
| PRIORITY
|--------------------------------------------------------------------------
*/

export async function updateTicketPriority(
    channel,
    priority,
    updater
) {
    try {
        const ticketData =
            requireTicket(
                await getTicketData(
                    channel.guild.id,
                    channel.id
                ),
                channel
            );

        if (
            !PRIORITY_MAP[priority]
        ) {
            ticketUserError(
                'Invalid priority level',
                'Invalid priority level.'
            );
        }

        const previousPriority =
            ticketData.priority ||
            'none';

        ticketData.priority =
            priority;

        ticketData.priorityUpdatedBy =
            updater.id;

        ticketData.priorityUpdatedAt =
            new Date().toISOString();

        await saveTicketData(
            channel.guild.id,
            channel.id,
            ticketData
        );

        /*
        |--------------------------------------------------------------------------
        | Replace the emoji.
        |
        | High -> Medium = Medium emoji
        | Medium -> None = no emoji
        | None -> High = High emoji
        |--------------------------------------------------------------------------
        */

        const baseName =
            stripPriorityPrefix(
                channel.name
            );

        const newName =
            applyPriorityToChannelName(
                baseName,
                priority
            );

        if (
            newName !==
            channel.name
        ) {
            await channel.setName(
                newName
            ).catch(
                error =>
                    logger.warn(
                        `Failed to update priority channel name: ${error.message}`
                    )
            );
        }

        await refreshMainTicketMessage(
            channel,
            ticketData
        );

        await logTicketEvent({
            client:
                channel.client,

            guildId:
                channel.guild.id,

            event: {
                type:
                    'priority',

                ticketId:
                    channel.id,

                ticketNumber:
                    ticketData.ticketNumber ||
                    ticketData.id,

                userId:
                    ticketData.userId,

                executorId:
                    updater.id,

                priority,

                metadata: {
                    previousPriority,
                },
            },
        }).catch(
            () => null
        );

        return ticketData;

    } catch (error) {
        rethrowTicketError(
            error,
            'updateTicketPriority',
            'Failed to update ticket priority.',
            {
                guildId:
                    channel?.guild?.id,
                channelId:
                    channel?.id,
                priority,
                updaterId:
                    updater?.id,
            }
        );
    }
}


/*
|--------------------------------------------------------------------------
| CLOSE
|--------------------------------------------------------------------------
*/

export async function closeTicket(
    channel,
    closer,
    reason = 'No reason provided'
) {
    try {
        const ticketData =
            requireTicket(
                await getTicketData(
                    channel.guild.id,
                    channel.id
                ),
                channel
            );

        ticketData.status =
            'closed';

        ticketData.closedBy =
            closer.id;

        ticketData.closedAt =
            new Date().toISOString();

        ticketData.closeReason =
            reason;

        await saveTicketData(
            channel.guild.id,
            channel.id,
            ticketData
        );

        await refreshMainTicketMessage(
            channel,
            ticketData,
            {
                components: false,
            }
        );

        await channel.permissionOverwrites.edit(
            ticketData.userId,
            {
                ViewChannel:
                    false,

                SendMessages:
                    false,
            }
        ).catch(
            () => null
        );

        await channel.send({
            embeds: [
                createEmbed({
                    title:
                        'Ticket Closed',

                    description:
                        `${closer} closed this ticket.\n\n` +
                        `**Reason:** ${reason}`,

                    color:
                        '#e74c3c',
                }),
            ],

            components: [
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(
                                'ticket_reopen'
                            )
                            .setLabel(
                                'Reopen Ticket'
                            )
                            .setStyle(
                                ButtonStyle.Success
                            )
                            .setEmoji('🔓'),

                        new ButtonBuilder()
                            .setCustomId(
                                'ticket_delete'
                            )
                            .setLabel(
                                'Delete Ticket'
                            )
                            .setStyle(
                                ButtonStyle.Danger
                            )
                            .setEmoji('🗑️')
                    ),
            ],
        });

        await logTicketEvent({
            client:
                channel.client,

            guildId:
                channel.guild.id,

            event: {
                type:
                    'close',

                ticketId:
                    channel.id,

                ticketNumber:
                    ticketData.ticketNumber ||
                    ticketData.id,

                userId:
                    ticketData.userId,

                executorId:
                    closer.id,

                reason,
            },
        }).catch(
            () => null
        );

        return ticketData;

    } catch (error) {
        rethrowTicketError(
            error,
            'closeTicket',
            'Failed to close ticket.',
            {
                guildId:
                    channel?.guild?.id,
                channelId:
                    channel?.id,
                closerId:
                    closer?.id,
            }
        );
    }
}


/*
|--------------------------------------------------------------------------
| REOPEN
|--------------------------------------------------------------------------
*/

export async function reopenTicket(
    channel,
    reopener
) {
    try {
        const ticketData =
            requireTicket(
                await getTicketData(
                    channel.guild.id,
                    channel.id
                ),
                channel
            );

        if (
            ticketData.status !==
            'closed'
        ) {
            ticketUserError(
                'Ticket not closed',
                'This ticket is not currently closed.'
            );
        }

        ticketData.status =
            'open';

        ticketData.closedBy =
            null;

        ticketData.closedAt =
            null;

        ticketData.closeReason =
            null;

        await saveTicketData(
            channel.guild.id,
            channel.id,
            ticketData
        );

        await channel.permissionOverwrites.edit(
            ticketData.userId,
            {
                ViewChannel:
                    true,

                SendMessages:
                    true,

                ReadMessageHistory:
                    true,

                AttachFiles:
                    true,
            }
        ).catch(
            () => null
        );

        await refreshMainTicketMessage(
            channel,
            ticketData
        );

        await channel.send({
            embeds: [
                createEmbed({
                    title:
                        'Ticket Reopened',

                    description:
                        `🔓 ${reopener} reopened this ticket.`,

                    color:
                        '#2ecc71',
                }),
            ],
        });

        await logTicketEvent({
            client:
                channel.client,

            guildId:
                channel.guild.id,

            event: {
                type:
                    'reopen',

                ticketId:
                    channel.id,

                ticketNumber:
                    ticketData.ticketNumber ||
                    ticketData.id,

                userId:
                    ticketData.userId,

                executorId:
                    reopener.id,
            },
        }).catch(
            () => null
        );

        return ticketData;

    } catch (error) {
        rethrowTicketError(
            error,
            'reopenTicket',
            'Failed to reopen ticket.',
            {
                guildId:
                    channel?.guild?.id,
                channelId:
                    channel?.id,
                reopenerId:
                    reopener?.id,
            }
        );
    }
}


/*
|--------------------------------------------------------------------------
| DELETE
|--------------------------------------------------------------------------
*/

export async function deleteTicket(
    channel,
    deleter
) {
    try {
        const ticketData =
            requireTicket(
                await getTicketData(
                    channel.guild.id,
                    channel.id
                ),
                channel
            );

        await channel.send({
            embeds: [
                createEmbed({
                    title:
                        'Ticket Deleted',

                    description:
                        `🗑️ This ticket will be deleted in 3 seconds.`,

                    color:
                        '#e74c3c',
                }),
            ],
        });

        await logTicketEvent({
            client:
                channel.client,

            guildId:
                channel.guild.id,

            event: {
                type:
                    'delete',

                ticketId:
                    channel.id,

                ticketNumber:
                    ticketData.ticketNumber ||
                    ticketData.id,

                userId:
                    ticketData.userId,

                executorId:
                    deleter.id,
            },
        }).catch(
            () => null
        );

        setTimeout(
            async () => {
                try {
                    await deleteTicketData(
                        channel.guild.id,
                        channel.id
                    ).catch(
                        () => null
                    );

                    await channel.delete(
                        'Ticket deleted permanently'
                    );
                } catch (error) {
                    logger.error(
                        'Failed to delete ticket:',
                        error
                    );
                }
            },
            TICKET_DELETE_DELAY_MS
        );

        return ticketData;

    } catch (error) {
        rethrowTicketError(
            error,
            'deleteTicket',
            'Failed to delete ticket.',
            {
                guildId:
                    channel?.guild?.id,
                channelId:
                    channel?.id,
                deleterId:
                    deleter?.id,
            }
        );
    }
}
