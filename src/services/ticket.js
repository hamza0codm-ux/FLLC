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

/*
|--------------------------------------------------------------------------
| Ping User Cooldown
|--------------------------------------------------------------------------
|
| Ticket creator can be pinged once every 4 hours.
|
| The button is intentionally NOT disabled during the cooldown.
| The cooldown is enforced server-side inside pingTicketUser().
|
*/

const TICKET_USER_PING_COOLDOWN_MS =
  4 * 60 * 60 * 1000;

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
|
| IMPORTANT:
| Ping User is intentionally NEVER disabled here.
|
| The 4-hour cooldown is checked server-side by pingTicketUser().
| This means:
|
| - Button remains available
| - Staff can click it at any time
| - Cooldown is checked securely
| - After 4 hours it automatically works again
| - Bot restarts do not reset the cooldown
|
*/

export function buildTicketControlRow({
  claimedBy = null,
} = {}) {
  if (claimedBy) {
    return new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            'ticket_unclaim'
          )
          .setLabel(
            'Unclaim'
          )
          .setEmoji(
            '↩️'
          )
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            'ticket_ping_user'
          )
          .setLabel(
            'Ping User'
          )
          .setEmoji(
            '🔔'
          )
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            'ticket_priority'
          )
          .setLabel(
            'Priority'
          )
          .setEmoji(
            '💼'
          )
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
          .setEmoji(
            '🔒'
          )
          .setStyle(
            ButtonStyle.Danger
          )
      );
  }

  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          'ticket_claim'
        )
        .setLabel(
          'Claim'
        )
        .setEmoji(
          '🙋‍♂️'
        )
        .setStyle(
          ButtonStyle.Primary
        ),

      new ButtonBuilder()
        .setCustomId(
          'ticket_ping_user'
        )
        .setLabel(
          'Ping User'
        )
        .setEmoji(
          '🔔'
        )
        .setStyle(
          ButtonStyle.Secondary
        ),

      new ButtonBuilder()
        .setCustomId(
          'ticket_priority'
        )
        .setLabel(
          'Priority'
        )
        .setEmoji(
          '💼'
        )
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
        .setEmoji(
          '🔒'
        )
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
        'Invalid ticket context
