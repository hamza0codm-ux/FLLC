// src/services/ticket.js

import {
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  AttachmentBuilder,
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


/*
|--------------------------------------------------------------------------
| Fruity Ticket Constants
|--------------------------------------------------------------------------
*/

const TICKET_DELETE_DELAY_MS = 3000;

const TICKET_DELETE_DELAY_SECONDS =
  Math.floor(
    TICKET_DELETE_DELAY_MS / 1000
  );

const TICKET_SERVICE =
  'ticketService';

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


/*
|--------------------------------------------------------------------------
| Error Helpers
|--------------------------------------------------------------------------
*/

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
      service:
        TICKET_SERVICE,

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
        channelId:
          channel?.id,

        guildId:
          channel?.guild?.id,
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
      service:
        TICKET_SERVICE,

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
| Formatting Helpers
|--------------------------------------------------------------------------
*/

function cleanNamePart(
  value,
  fallback = 'ticket'
) {
  const cleaned =
    String(
      value ||
      fallback
    )
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

  return (
    cleaned ||
    fallback
  );
}


function getPriorityInfo(
  priority
) {
  return (
    PRIORITY_MAP[
      priority
    ] ||
    PRIORITY_MAP.none ||
    {
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
    priority ===
    'none'
  ) {
    return '⚪ None';
  }

  return (
    `${info.emoji || ''} ${info.label}`
  ).trim();
}


function getPriorityEmoji(
  priority
) {
  return (
    getPriorityInfo(
      priority
    ).emoji ||
    ''
  );
}


function removePriorityEmoji(
  channelName
) {
  return String(
    channelName || ''
  )
    .replace(
      /^(?:⚪|🟢|🟡|🔴|🚨)\s*/u,
      ''
    );
}


function applyPriorityToName(
  channelName,
  priority
) {
  const baseName =
    removePriorityEmoji(
      channelName
    );

  const emoji =
    getPriorityEmoji(
      priority
    );

  if (
    !emoji ||
    priority === 'none'
  ) {
    return baseName;
  }

  return `${emoji}-${baseName}`;
}


/*
|--------------------------------------------------------------------------
| Ticket Name Helpers
|--------------------------------------------------------------------------
*/

function getTicketTypeName(
  ticketData
) {
  return cleanNamePart(
    ticketData?.ticketTypeKey ||
    ticketData?.ticketType ||
    'ticket'
  );
}


function getTicketUsername(
  member
) {
  return cleanNamePart(
    member?.user?.username ||
    member?.displayName ||
    member?.user?.globalName ||
    'user',
    'user'
  );
}


async function generateTicketChannelName(
  guild,
  ticketType,
  member
) {
  const typeName =
    cleanNamePart(
      ticketType,
      'ticket'
    );

  const username =
    getTicketUsername(
      member
    );

  const baseName =
    `${typeName}-${username}`;

  let name =
    baseName;

  let number =
    1;

  while (
    guild.channels.cache.some(
      channel =>
        channel.type ===
          ChannelType.GuildText &&
        channel.name === name
    )
  ) {
    number += 1;

    name =
      `${baseName}-${number}`;
  }

  return name.slice(
    0,
    100
  );
}


function buildTicketEmbed(
  ticketData
) {
  const priority =
    ticketData.priority ||
    'none';

  const claimedBy =
    ticketData.claimedBy
      ? `<@${ticketData.claimedBy}>`
      : 'Not claimed';

  const status =
    ticketData.status === 'closed'
      ? CLOSED_STATUS
      : OPEN_STATUS;

  const description =
    `${ticketData.userMention || `<@${ticketData.userId}>`}, thank you for opening a ticket.\n\n` +

    `**Ticket Type:** ${ticketData.ticketType || 'Unknown'}\n` +
    `**Reason:** ${ticketData.reason || 'Not provided'}\n` +
    `**Priority:** ${getPriorityDisplay(priority)}\n` +
    `**Status:** ${status}\n` +
    `**Claimed By:** ${claimedBy}\n\n` +

    `---------------------------------------------------\n\n` +

    `${ticketData.teamText || DEFAULT_TEAM_TEXT}\n` +
    `Please provide your details now so we can assist you faster.\n` +
    `Please do not ping owners or staff members too much.`;

  return createEmbed({
    title:
      ticketData.title ||
      `Ticket #${ticketData.id}`,

    description,

    color:
      getPriorityInfo(
        priority
      ).color,

    footer: {
      text:
        `Ticket #${ticketData.id}`,
    },
  });
}


/*
|--------------------------------------------------------------------------
| Ticket Controls
|--------------------------------------------------------------------------
*/

export function buildTicketControlRow({
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
        .setEmoji('🙋‍♂️')
        .setStyle(
          ButtonStyle.Primary
        )
        .setDisabled(
          Boolean(claimedBy)
        ),

      new ButtonBuilder()
        .setCustomId(
          'ticket_priority'
        )
        .setLabel(
          'Priority'
        )
        .setEmoji('💼')
        .setStyle(
          ButtonStyle.Secondary
        ),

      new ButtonBuilder()
        .setCustomId(
          'ticket_close'
        )
        .setLabel(
          'Close'
        )
        .setEmoji('🔒')
        .setStyle(
          ButtonStyle.Danger
        )
    );
}


/*
|--------------------------------------------------------------------------
| Find Ticket Message
|--------------------------------------------------------------------------
*/

async function findTicketMessage(
  channel
) {
  const messages =
    await channel.messages.fetch({
      limit: 100,
    });

  return (
    messages.find(
      message =>
        message.author?.id ===
          channel.client.user.id &&
        (
          message.embeds?.length ||
          message.components?.length
        )
    ) ||
    null
  );
}


/*
|--------------------------------------------------------------------------
| Update Ticket Message
|--------------------------------------------------------------------------
*/

async function updateTicketMessage(
  channel,
  ticketData
) {
  const ticketMessage =
    await findTicketMessage(
      channel
    );

  if (!ticketMessage) {
    return;
  }

  const embed =
    buildTicketEmbed(
      ticketData
    );

  const components =
    ticketData.status ===
      'closed'
      ? []
      : [
          buildTicketControlRow({
            claimedBy:
              ticketData.claimedBy,
          }),
        ];

  await ticketMessage.edit({
    embeds: [
      embed,
    ],

    components,
  });
}


/*
|--------------------------------------------------------------------------
| Create Ticket
|--------------------------------------------------------------------------
*/

export async function createTicket(
  guild,
  member,
  categoryId,
  reason,
  ticketType,
  options = {}
) {
  try {
    if (
      !guild ||
      !member
    ) {
      ticketUserError(
        'Invalid ticket context',
        'Unable to create the ticket.',
        ErrorTypes.VALIDATION
      );
    }

    const openCount =
      await getOpenTicketCountForUser(
        guild.id,
        member.id
      );

    if (
      openCount >= 3
    ) {
      ticketUserError(
        'Ticket limit reached',
        'You already have the maximum number of open tickets.',
        ErrorTypes.VALIDATION
      );
    }

    const panelType =
      String(
        options.panelType ||
        'normal'
      ).toLowerCase();

    const ticketTypeKey =
      options.ticketTypeKey ||
      ticketType ||
      'ticket';

    const ticketTypeLabel =
      options.ticketType ||
      ticketTypeKey;

    const staffRoleId =
      options.staffRoleId ||
      null;

    const ticketLogsChannelId =
      options.ticketLogsChannelId ||
      null;

    const transcriptLogsChannelId =
      options.transcriptLogsChannelId ||
      null;

    const reviewLogsChannelId =
      options.reviewLogsChannelId ||
      null;

    const teamText =
      options.teamText ||
      DEFAULT_TEAM_TEXT;

    const ticketNumber =
      await getNextTicketNumber(
        guild.id
      );

    const baseName =
      await generateTicketChannelName(
        guild,
        ticketTypeKey,
        member
      );

    const channel =
      await guild.channels.create({
        name:
          baseName,

        type:
          ChannelType.GuildText,

        parent:
          categoryId || null,

        permissionOverwrites: [
          {
            id:
              guild.roles.everyone.id,

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
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
            ],
          },

          ...(staffRoleId
            ? [
                {
                  id:
                    staffRoleId,

                  allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.ManageMessages,
                  ],
                },
              ]
            : []),
        ],
      });

    const autoHighPriority =
      AUTO_HIGH_PRIORITY_ROLE_IDS.some(
        roleId =>
          member.roles?.cache?.has(
            roleId
          )
      );

    const initialPriority =
      autoHighPriority
        ? 'high'
        : 'none';

    const ticketData = {
      id:
        ticketNumber,

      ticketNumber,

      channelId:
        channel.id,

      guildId:
        guild.id,

      userId:
        member.id,

      userMention:
        `<@${member.id}>`,

      username:
        member.user?.username ||
        member.displayName,

      panelType,

      ticketType:
        ticketTypeLabel,

      ticketTypeKey,

      reason:
        reason ||
        'Not provided',

      priority:
        initialPriority,

      status:
        'open',

      claimedBy:
        null,

      claimedAt:
        null,

      closedBy:
        null,

      closedAt:
        null,

      closeReason:
        null,

      createdAt:
        new Date().toISOString(),

      categoryId:
        categoryId || null,

      staffRoleId,

      teamText,

      ticketLogsChannelId,

      transcriptLogsChannelId,

      reviewLogsChannelId,
    };

    await saveTicketData(
      guild.id,
      channel.id,
      ticketData
    );

    const embed =
      buildTicketEmbed(
        ticketData
      );

    await channel.send({
      content:
        `${member}`,

      embeds: [
        embed,
      ],

      components: [
        buildTicketControlRow({
          claimedBy:
            null,
        }),
      ],

      allowedMentions: {
        users: [
          member.id,
        ],

        roles: [],
      },
    });

    if (
      initialPriority !==
      'none'
    ) {
      const priorityName =
        applyPriorityToName(
          channel.name,
          initialPriority
        );

      await channel.setName(
        priorityName
      );
    }

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

        panelType,

        ticketData,

        ticketLogsChannelId,

        transcriptLogsChannelId,

        reviewLogsChannelId,

        reason:
          reason ||
          'Not provided',
      },
    });

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
| Claim Ticket
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
        ErrorTypes.VALIDATION,
        {
          channelId:
            channel.id,

          claimedBy:
            ticketData.claimedBy,

          operation:
            'claimTicket',
        }
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

    await updateTicketMessage(
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
          ticketData.id,

        userId:
          ticketData.userId,

        executorId:
          claimer.id,

        panelType:
          ticketData.panelType,

        ticketData,

        ticketLogsChannelId:
          ticketData.ticketLogsChannelId,

        transcriptLogsChannelId:
          ticketData.transcriptLogsChannelId,

        reviewLogsChannelId:
          ticketData.reviewLogsChannelId,

        metadata: {
          claimedAt:
            ticketData.claimedAt,
        },
      },
    });

    return ticketData;

  } catch (error) {
    rethrowTicketError(
      error,
      'claimTicket',
      'Failed to claim ticket. Please try again in a moment.',
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
| Unclaim Ticket
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
        'This ticket is not currently claimed.',
        ErrorTypes.VALIDATION
      );
    }

    ticketData.claimedBy =
      null;

    ticketData.claimedAt =
      null;

    await saveTicketData(
      channel.guild.id,
      channel.id,
      ticketData
    );

    await updateTicketMessage(
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
          ticketData.id,

        userId:
          ticketData.userId,

        executorId:
          unclaimer.id,

        panelType:
          ticketData.panelType,

        ticketData,

        ticketLogsChannelId:
          ticketData.ticketLogsChannelId,

        transcriptLogsChannelId:
          ticketData.transcriptLogsChannelId,

        reviewLogsChannelId:
          ticketData.reviewLogsChannelId,

        metadata: {
          unclaimedAt:
            new Date().toISOString(),
        },
      },
    });

    return ticketData;

  } catch (error) {
    rethrowTicketError(
      error,
      'unclaimTicket',
      'Failed to unclaim ticket. Please try again in a moment.',
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
| Update Ticket Priority
|--------------------------------------------------------------------------
*/

export async function updateTicketPriority(
  channel,
  priority,
  executor
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

    const normalizedPriority =
      String(
        priority ||
        'none'
      ).toLowerCase();

    if (
      !PRIORITY_MAP[
        normalizedPriority
      ]
    ) {
      ticketUserError(
        'Invalid priority',
        'That is not a valid ticket priority.',
        ErrorTypes.VALIDATION,
        {
          priority:
            normalizedPriority,
        }
      );
    }

    ticketData.priority =
      normalizedPriority;

    await saveTicketData(
      channel.guild.id,
      channel.id,
      ticketData
    );

    const newName =
      applyPriorityToName(
        channel.name,
        normalizedPriority
      );

    if (
      channel.name !==
      newName
    ) {
      await channel.setName(
        newName
      );
    }

    await updateTicketMessage(
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
          ticketData.id,

        userId:
          ticketData.userId,

        executorId:
          executor.id,

        priority:
          normalizedPriority,

        panelType:
          ticketData.panelType,

        ticketData,

        ticketLogsChannelId:
          ticketData.ticketLogsChannelId,

        transcriptLogsChannelId:
          ticketData.transcriptLogsChannelId,

        reviewLogsChannelId:
          ticketData.reviewLogsChannelId,
      },
    });

    return ticketData;

  } catch (error) {
    rethrowTicketError(
      error,
      'updateTicketPriority',
      'Failed to update ticket priority. Please try again in a moment.',
      {
        guildId:
          channel?.guild?.id,

        channelId:
          channel?.id,

        executorId:
          executor?.id,

        priority,
      }
    );
  }
}


/*
|--------------------------------------------------------------------------
| Close Ticket
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

    if (
      ticketData.status ===
      'closed'
    ) {
      ticketUserError(
        'Ticket already closed',
        'This ticket is already closed.',
        ErrorTypes.VALIDATION
      );
    }

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

    await updateTicketMessage(
      channel,
      ticketData
    );

    const closerMention =
      `<@${closer.id}>`;

    const closeEmbed =
      createEmbed({
        title:
          'Ticket Closed',

        description:
          `This ticket has been closed by ${closerMention}.\n` +
          `**Reason:** ${reason}`,

        color:
          0xED4245,

        footer: {
          text:
            `Ticket #${ticketData.id}`,
        },
      });

    const controlRow =
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
        );

    await channel.send({
      embeds: [
        closeEmbed,
      ],

      components: [
        controlRow,
      ],
    });


    /*
|--------------------------------------------------------------------------
| Send Review DM to Ticket Creator
|--------------------------------------------------------------------------
*/

try {
  const ticketCreator =
    await channel.client.users.fetch(
      ticketData.userId
    );

  if (ticketCreator) {
    const reviewEmbed =
      createEmbed({
        title:
          'How was your support experience?',

        description:
          `We'd love to know how we did with **ticket-${String(ticketData.id).padStart(3, '0')}**.\n` +
          'Select a rating below — it only takes a second!',

        color:
          0xF8D568,
      });

    /*
    |--------------------------------------------------------------------------
    | Rating Buttons
    |--------------------------------------------------------------------------
    */

    const reviewRow =
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `ticket_feedback:${channel.guild.id}:${channel.id}:1`
            )
            .setLabel('1')
            .setEmoji('⭐')
            .setStyle(
              ButtonStyle.Secondary
            ),

          new ButtonBuilder()
            .setCustomId(
              `ticket_feedback:${channel.guild.id}:${channel.id}:2`
            )
            .setLabel('2')
            .setEmoji('⭐')
            .setStyle(
              ButtonStyle.Secondary
            ),

          new ButtonBuilder()
            .setCustomId(
              `ticket_feedback:${channel.guild.id}:${channel.id}:3`
            )
            .setLabel('3')
            .setEmoji('⭐')
            .setStyle(
              ButtonStyle.Secondary
            ),

          new ButtonBuilder()
            .setCustomId(
              `ticket_feedback:${channel.guild.id}:${channel.id}:4`
            )
            .setLabel('4')
            .setEmoji('⭐')
            .setStyle(
              ButtonStyle.Secondary
            ),

          new ButtonBuilder()
            .setCustomId(
              `ticket_feedback:${channel.guild.id}:${channel.id}:5`
            )
            .setLabel('5')
            .setEmoji('⭐')
            .setStyle(
              ButtonStyle.Secondary
            )
        );

    /*
    |--------------------------------------------------------------------------
    | Comment / Decline Buttons
    |--------------------------------------------------------------------------
    */

    const commentRow =
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `ticket_feedback_comment:${channel.guild.id}:${channel.id}`
            )
            .setLabel(
              'Add Comment'
            )
            .setEmoji('💅')
            .setStyle(
              ButtonStyle.Secondary
            ),

          new ButtonBuilder()
            .setCustomId(
              'ticket_feedback_decline'
            )
            .setLabel(
              'No thanks'
            )
            .setEmoji('❌')
            .setStyle(
              ButtonStyle.Secondary
            )
        );

    await ticketCreator.send({
      embeds: [
        reviewEmbed,
      ],

      components: [
        reviewRow,
        commentRow,
      ],
    });

    logger.info(
      'Ticket review DM sent successfully',
      {
        channelId:
          channel.id,

        ticketNumber:
          ticketData.ticketNumber ||
          ticketData.id,

        userId:
          ticketData.userId,
      }
    );
  }

} catch (dmError) {
  logger.warn(
    `Could not DM ticket review to ticket creator ${ticketData.userId}: ${dmError.message}`
  );
}
    /*
    |--------------------------------------------------------------------------
    | Ticket Close Log
    |--------------------------------------------------------------------------
    */

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
          ticketData.id,

        userId:
          ticketData.userId,

        executorId:
          closer.id,

        panelType:
          ticketData.panelType,

        ticketData,

        ticketLogsChannelId:
          ticketData.ticketLogsChannelId,

        transcriptLogsChannelId:
          ticketData.transcriptLogsChannelId,

        reviewLogsChannelId:
          ticketData.reviewLogsChannelId,

        reason,
      },
    });

    return ticketData;

  } catch (error) {
    rethrowTicketError(
      error,
      'closeTicket',
      'Failed to close ticket. Please try again in a moment.',
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
| Reopen Ticket
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
        'This ticket is not currently closed.',
        ErrorTypes.VALIDATION
      );
    }

    const config =
      await getGuildConfig(
        channel.client,
        channel.guild.id
      );

    const openCategoryId =
      ticketData.categoryId ||
      config.ticketCategoryId ||
      null;

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

    if (
      openCategoryId &&
      channel.parentId !==
        openCategoryId
    ) {
      const openCategory =
        channel.guild.channels.cache.get(
          openCategoryId
        ) ||
        await channel.guild.channels.fetch(
          openCategoryId
        ).catch(
          () => null
        );

      if (
        openCategory?.type ===
        ChannelType.GuildCategory
      ) {
        try {
          await channel.setParent(
            openCategoryId,
            {
              lockPermissions:
                false,
            }
          );
        } catch (error) {
          logger.warn(
            `Could not move reopened ticket ${channel.id}: ${error.message}`
          );
        }
      }
    }

    try {
      const user =
        await channel.guild.members.fetch(
          ticketData.userId
        ).catch(
          () => null
        );

      if (user) {
        await channel.permissionOverwrites.edit(
          user,
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
        );
      }
    } catch (error) {
      logger.warn(
        `Could not restore access for user ${ticketData.userId}: ${error.message}`
      );
    }

    await updateTicketMessage(
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
          'reopen',

        ticketId:
          channel.id,

        ticketNumber:
          ticketData.id,

        userId:
          ticketData.userId,

        executorId:
          reopener.id,

        panelType:
          ticketData.panelType,

        ticketData,

        ticketLogsChannelId:
          ticketData.ticketLogsChannelId,

        transcriptLogsChannelId:
          ticketData.transcriptLogsChannelId,

        reviewLogsChannelId:
          ticketData.reviewLogsChannelId,
      },
    });

    return ticketData;

  } catch (error) {
    rethrowTicketError(
      error,
      'reopenTicket',
      'Failed to reopen ticket. Please try again in a moment.',
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
| Build Transcript
|--------------------------------------------------------------------------
*/

async function buildTicketTranscript(
  channel
) {
  const messages =
    await channel.messages.fetch({
      limit: 100,
    });

  const sortedMessages =
    [...messages.values()]
      .sort(
        (a, b) =>
          a.createdTimestamp -
          b.createdTimestamp
      );

  const lines = [];

  lines.push(
    `Fruity Ticket Transcript`
  );

  lines.push(
    `Server: ${channel.guild.name}`
  );

  lines.push(
    `Channel: #${channel.name}`
  );

  lines.push(
    `Channel ID: ${channel.id}`
  );

  lines.push(
    `Generated: ${new Date().toISOString()}`
  );

  lines.push(
    ''
  );

  for (
    const message of sortedMessages
  ) {
    const timestamp =
      new Date(
        message.createdTimestamp
      ).toISOString();

    const author =
      message.author
        ? `${message.author.tag} (${message.author.id})`
        : 'Unknown User';

    const content =
      message.cleanContent ||
      message.content ||
      '';

    lines.push(
      `[${timestamp}] ${author}: ${content}`
    );

    if (
      message.attachments?.size
    ) {
      for (
        const attachment of
        message.attachments.values()
      ) {
        lines.push(
          `Attachment: ${attachment.url}`
        );
      }
    }

    if (
      message.embeds?.length
    ) {
      lines.push(
        `Embeds: ${message.embeds.length}`
      );
    }

    lines.push('');
  }

  const transcript =
    lines.join('\n');

  return {
    transcript,

    messageCount:
      sortedMessages.length,
  };
}


/*
|--------------------------------------------------------------------------
| Delete Ticket
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

    /*
    |--------------------------------------------------------------------------
    | Save everything required before deleting the channel.
    |--------------------------------------------------------------------------
    */

    const transcript =
      await buildTicketTranscript(
        channel
      );

    const transcriptBuffer =
      Buffer.from(
        transcript.transcript,
        'utf8'
      );

    const transcriptAttachment =
      new AttachmentBuilder(
        transcriptBuffer,
        {
          name:
            `${channel.name}-transcript.txt`,
        }
      );

    /*
    |--------------------------------------------------------------------------
    | Transcript event
    |--------------------------------------------------------------------------
    |
    | The transcript goes to:
    |
    | 1. The panel's transcript log channel
    | 2. The ticket creator's DMs
    |
    */

    await logTicketEvent({
      client:
        channel.client,

      guildId:
        channel.guild.id,

      event: {
        type:
          'transcript',

        ticketId:
          channel.id,

        ticketNumber:
          ticketData.id,

        userId:
          ticketData.userId,

        panelType:
          ticketData.panelType,

        ticketData,

        ticketLogsChannelId:
          ticketData.ticketLogsChannelId,

        transcriptLogsChannelId:
          ticketData.transcriptLogsChannelId,

        reviewLogsChannelId:
          ticketData.reviewLogsChannelId,

        metadata: {
          messageCount:
            transcript.messageCount,

          duration:
            ticketData.createdAt
              ? `${Math.floor(
                  (
                    Date.now() -
                    new Date(
                      ticketData.createdAt
                    ).getTime()
                  ) / 1000
                )} seconds`
              : null,
        },

        attachments: [
          transcriptAttachment,
        ],
      },
    });

    /*
    |--------------------------------------------------------------------------
    | DM transcript to ticket creator
    |--------------------------------------------------------------------------
    */

    try {
      const ticketCreator =
        await channel.client.users.fetch(
          ticketData.userId
        );

      if (
        ticketCreator
      ) {
        const dmEmbed =
          buildStandardLogEmbed({
            color:
              0x57F287,

            title:
              '📄 Ticket Transcript',

            inlineFields: [
              {
                name:
                  'Ticket',

                value:
                  `#${ticketData.id}`,

                inline:
                  true,
              },

              {
                name:
                  'Panel',

                value:
                  ticketData.panelType ===
                    'merch'
                    ? 'Merch'
                    : 'Normal',

                inline:
                  true,
              },

              {
                name:
                  'Messages',

                value:
                  String(
                    transcript.messageCount
                  ),

                inline:
                  true,
              },
            ],

            fields: [
              {
                name:
                  'Transcript',

                value:
                  'A copy of your Fruity ticket transcript is attached below.',

                inline:
                  false,
              },
            ],

            footer: {
              text:
                'Fruity Ticketing',
            },
          });

        const dmAttachment =
          new AttachmentBuilder(
            Buffer.from(
              transcript.transcript,
              'utf8'
            ),
            {
              name:
                `${channel.name}-transcript.txt`,
            }
          );

        await ticketCreator.send({
          embeds: [
            dmEmbed,
          ],

          files: [
            dmAttachment,
          ],
        });

        logger.info(
          'Transcript DM sent successfully',
          {
            channelId:
              channel.id,

            ticketNumber:
              ticketData.ticketNumber ||
              ticketData.id,

            userId:
              ticketData.userId,
          }
        );
      }

    } catch (dmError) {
      logger.warn(
        `Could not DM transcript to ticket creator ${ticketData.userId}: ${dmError.message}`
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Ticket deletion log
    |--------------------------------------------------------------------------
    */

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
          ticketData.id,

        userId:
          ticketData.userId,

        executorId:
          deleter.id,

        panelType:
          ticketData.panelType,

        ticketData,

        ticketLogsChannelId:
          ticketData.ticketLogsChannelId,

        transcriptLogsChannelId:
          ticketData.transcriptLogsChannelId,

        reviewLogsChannelId:
          ticketData.reviewLogsChannelId,

        metadata: {
          transcriptGenerated:
            true,
        },
      },
    });

    /*
    |--------------------------------------------------------------------------
    | Delay deletion slightly so Discord has time to finish sending logs.
    |--------------------------------------------------------------------------
    */

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
            'Unexpected error during ticket deletion:',
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
      'Failed to delete ticket. Please try again in a moment.',
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


/*
|--------------------------------------------------------------------------
| User Ticket Count
|--------------------------------------------------------------------------
*/

export async function getUserTicketCount(
  guildId,
  userId
) {
  return await getOpenTicketCountForUser(
    guildId,
    userId
  );
}


/*
|--------------------------------------------------------------------------
| Internal Ticket Number
|--------------------------------------------------------------------------
*/

async function getNextTicketNumber(
  guildId
) {
  return await incrementTicketCounter(
    guildId
  );
}
