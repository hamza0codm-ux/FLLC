// src/utils/ticket/ticketLogging.js

import { ChannelType } from 'discord.js';

import { getGuildConfig } from '../../services/config/guildConfig.js';
import { getTicketData } from '../database.js';
import { logger } from '../logger.js';
import {
  buildStandardLogEmbed,
  formatRatingStars,
  resolveUserAuthor,
} from '../logging/logEmbeds.js';

/*
|--------------------------------------------------------------------------
| Fruity Ticket Log Channels
|--------------------------------------------------------------------------
|
| Normal and Merch tickets have completely separate logging channels.
|
*/

const TICKET_LOG_CHANNELS = {
  normal: {
    ticket: '1542845775988391937',
    transcript: '1542845853310390342',
    review: '1542859014499467285',
  },

  merch: {
    ticket: '1543331796568121467',
    transcript: '1543331916235931678',
    review: '1543332129117708380',
  },
};


/*
|--------------------------------------------------------------------------
| LOG TICKET EVENT
|--------------------------------------------------------------------------
*/

export async function logTicketEvent({
  client,
  guildId,
  event = {},
}) {
  try {
    const guild =
      client.guilds.cache.get(guildId) ||
      await client.guilds.fetch(guildId).catch(() => null);

    if (!guild) {
      logger.warn(
        `logTicketEvent invoked without valid guild: ${guildId}`
      );

      return;
    }

    /*
    |--------------------------------------------------------------------------
    | Resolve ticket data
    |--------------------------------------------------------------------------
    |
    | This allows feedback/review events to determine whether the ticket
    | belongs to the Normal or Merch panel.
    |
    */

    let ticketData =
      event.ticketData ||
      null;

    if (
      !ticketData &&
      event.ticketId
    ) {
      ticketData =
        await getTicketData(
          guildId,
          event.ticketId
        ).catch(
          () => null
        );
    }

    const panelType =
      String(
        event.panelType ||
        ticketData?.panelType ||
        ''
      ).toLowerCase();

    const panelChannels =
      TICKET_LOG_CHANNELS[
        panelType
      ] || null;

    const logChannelId =
      getLogChannelForEventType(
        event,
        ticketData,
        panelChannels
      );

    if (!logChannelId) {
      logger.warn(
        `No ticket log channel configured for event ${event.type} in guild ${guildId}`
      );

      return;
    }

    const channel =
      guild.channels.cache.get(
        logChannelId
      ) ||
      await guild.channels.fetch(
        logChannelId
      ).catch(
        () => null
      );

    if (!channel) {
      logger.warn(
        `Ticket log channel not found: ${logChannelId} for event type: ${event.type}`
      );

      return;
    }

    const permissions =
      channel.permissionsFor(
        guild.members.me
      );

    if (
      !permissions?.has([
        'SendMessages',
        'EmbedLinks',
      ])
    ) {
      logger.warn(
        `Missing permissions in ticket log channel: ${logChannelId}`
      );

      return;
    }

    const embed =
      await createTicketLogEmbed(
        guild,
        event,
        ticketData
      );

    const messageOptions = {
      embeds: [
        embed,
      ],
    };

    if (
      event.attachments &&
      event.attachments.length > 0
    ) {
      messageOptions.files =
        event.attachments;
    }

    await channel.send(
      messageOptions
    );

    logger.info(
      `Ticket event logged: ${event.type} in guild ${guildId} -> ${logChannelId}`
    );
  } catch (error) {
    logger.error(
      'Error logging ticket event:',
      error
    );
  }
}


/*
|--------------------------------------------------------------------------
| LOG TICKET FEEDBACK
|--------------------------------------------------------------------------
*/

export async function logTicketFeedback({
  client,
  guildId,
  ticketNumber,
  ticketChannelId,
  userId,
  rating = null,
  comment = null,
}) {
  await logTicketEvent({
    client,
    guildId,
    event: {
      type: 'feedback',
      ticketId: ticketChannelId,
      ticketNumber,
      userId,
      metadata: {
        rating,
        comment,
      },
    },
  });
}


/*
|--------------------------------------------------------------------------
| GET LOG CHANNEL
|--------------------------------------------------------------------------
*/

function getLogChannelForEventType(
  event,
  ticketData,
  panelChannels
) {
  const type =
    event.type;

  const ticketChannelId =
    event.ticketLogsChannelId ||
    ticketData?.ticketLogsChannelId ||
    panelChannels?.ticket ||
    null;

  const transcriptChannelId =
    event.transcriptLogsChannelId ||
    ticketData?.transcriptLogsChannelId ||
    panelChannels?.transcript ||
    null;

  const reviewChannelId =
    event.reviewLogsChannelId ||
    ticketData?.reviewLogsChannelId ||
    panelChannels?.review ||
    null;

  switch (type) {

    /*
    |--------------------------------------------------------------------------
    | Transcript
    |--------------------------------------------------------------------------
    */

    case 'transcript':
      return transcriptChannelId;


    /*
    |--------------------------------------------------------------------------
    | Reviews
    |--------------------------------------------------------------------------
    */

    case 'feedback':
    case 'review':
      return reviewChannelId;


    /*
    |--------------------------------------------------------------------------
    | Ticket lifecycle
    |--------------------------------------------------------------------------
    */

    case 'open':
    case 'close':
    case 'delete':
    case 'claim':
    case 'unclaim':
    case 'priority':
    case 'reopen':
    case 'pin':
    case 'unpin':
      return ticketChannelId;


    default:
      return null;
  }
}


/*
|--------------------------------------------------------------------------
| EVENT STYLES
|--------------------------------------------------------------------------
*/

const TICKET_EVENT_STYLES = {
  open: {
    color: 0x5865F2,
    title: 'Ticket Created',
  },

  close: {
    color: 0xED4245,
    title: 'Ticket Closed',
  },

  delete: {
    color: 0x8b0000,
    title: 'Ticket Deleted',
  },

  claim: {
    color: 0x5865F2,
    title: 'Ticket Claimed',
  },

  unclaim: {
    color: 0xFAA61A,
    title: 'Ticket Unclaimed',
  },

  priority: {
    color: 0x9b59b6,
    title: 'Priority Updated',
  },

  reopen: {
    color: 0x2ecc71,
    title: 'Ticket Reopened',
  },

  transcript: {
    color: 0x3498db,
    title: 'Transcript Generated',
  },

  feedback: {
    color: 0x57F287,
    title: 'Feedback Received',
  },

  review: {
    color: 0x57F287,
    title: 'Review Received',
  },
};


/*
|--------------------------------------------------------------------------
| CREATE TICKET LOG EMBED
|--------------------------------------------------------------------------
*/

async function createTicketLogEmbed(
  guild,
  event,
  ticketData = null
) {
  const style =
    TICKET_EVENT_STYLES[
      event.type
    ] || {
      color: 0x95a5a6,
      title: 'Ticket Event',
    };

  const ticketNumber =
    event.ticketNumber ||
    ticketData?.ticketNumber ||
    ticketData?.id ||
    event.ticketId;

  const ticketRef =
    ticketNumber
      ? `#${ticketNumber}`
      : 'Unknown';

  const channelId =
    event.ticketId ||
    ticketData?.channelId ||
    null;

  const channelMention =
    channelId
      ? `<#${channelId}>`
      : null;

  const executorMention =
    event.executorId
      ? `<@${event.executorId}>`
      : null;

  const userId =
    event.userId ||
    ticketData?.userId ||
    null;

  const userMention =
    userId
      ? `<@${userId}>`
      : null;

  let inlineFields = [];
  let fields = [];
  let author = null;

  const footer = {
    text: 'Fruity Ticketing',
  };

  switch (event.type) {

    /*
    |--------------------------------------------------------------------------
    | OPEN
    |--------------------------------------------------------------------------
    */

    case 'open':

      author =
        await resolveUserAuthor(
          guild.client,
          userId
        );

      inlineFields = [
        {
          name: 'Ticket',
          value: ticketRef,
          inline: true,
        },

        {
          name: 'Creator',
          value:
            userMention ||
            'Unknown',
          inline: true,
        },
      ];

      if (channelMention) {
        inlineFields.push({
          name: 'Channel',
          value: channelMention,
          inline: true,
        });
      }

      if (
        ticketData?.panelType
      ) {
        inlineFields.push({
          name: 'Panel',
          value:
            ticketData.panelType === 'merch'
              ? 'Merch'
              : 'Normal',
          inline: true,
        });
      }

      if (
        ticketData?.ticketType
      ) {
        inlineFields.push({
          name: 'Type',
          value:
            String(
              ticketData.ticketType
            ).slice(0, 1024),
          inline: true,
        });
      }

      if (
        event.reason ||
        ticketData?.reason
      ) {
        fields.push({
          name: 'Reason',
          value:
            String(
              event.reason ||
              ticketData.reason
            ).slice(0, 1024),
          inline: false,
        });
      }

      break;


    /*
    |--------------------------------------------------------------------------
    | CLOSE
    |--------------------------------------------------------------------------
    */

    case 'close':

      author =
        await resolveUserAuthor(
          guild.client,
          event.executorId
        );

      inlineFields = [
        {
          name: 'Ticket',
          value: ticketRef,
          inline: true,
        },

        {
          name: 'Closed by',
          value:
            executorMention ||
            'Unknown',
          inline: true,
        },
      ];

      if (channelMention) {
        inlineFields.push({
          name: 'Channel',
          value: channelMention,
          inline: true,
        });
      }

      if (event.reason) {
        fields.push({
          name: 'Reason',
          value:
            String(
              event.reason
            ).slice(0, 1024),
          inline: false,
        });
      }

      break;


    /*
    |--------------------------------------------------------------------------
    | DELETE
    |--------------------------------------------------------------------------
    */

    case 'delete':

      author =
        await resolveUserAuthor(
          guild.client,
          event.executorId
        );

      inlineFields = [
        {
          name: 'Ticket',
          value: ticketRef,
          inline: true,
        },

        {
          name: 'Deleted by',
          value:
            executorMention ||
            'Unknown',
          inline: true,
        },
      ];

      if (channelMention) {
        inlineFields.push({
          name: 'Channel',
          value: channelMention,
          inline: true,
        });
      }

      break;


    /*
    |--------------------------------------------------------------------------
    | CLAIM / UNCLAIM
    |--------------------------------------------------------------------------
    */

    case 'claim':
    case 'unclaim':

      author =
        await resolveUserAuthor(
          guild.client,
          event.executorId
        );

      inlineFields = [
        {
          name: 'Ticket',
          value: ticketRef,
          inline: true,
        },

        {
          name:
            event.type === 'claim'
              ? 'Claimed by'
              : 'Unclaimed by',

          value:
            executorMention ||
            'Unknown',

          inline: true,
        },
      ];

      break;


    /*
    |--------------------------------------------------------------------------
    | PRIORITY
    |--------------------------------------------------------------------------
    */

    case 'priority': {

      const priorityEmojis = {
        none: '⚪',
        low: '🟢',
        medium: '🟡',
        high: '🔴',
        urgent: '🚨',
      };

      const priority =
        event.priority ||
        ticketData?.priority ||
        'none';

      const priorityLabel =
        `${
          priorityEmojis[priority] ||
          '⚪'
        } ${
          String(priority)
            .charAt(0)
            .toUpperCase() +
          String(priority)
            .slice(1)
        }`;

      author =
        await resolveUserAuthor(
          guild.client,
          event.executorId
        );

      inlineFields = [
        {
          name: 'Ticket',
          value: ticketRef,
          inline: true,
        },

        {
          name: 'Priority',
          value: priorityLabel,
          inline: true,
        },

        {
          name: 'Updated by',
          value:
            executorMention ||
            'Unknown',
          inline: true,
        },
      ];

      break;
    }


    /*
    |--------------------------------------------------------------------------
    | REOPEN
    |--------------------------------------------------------------------------
    */

    case 'reopen':

      author =
        await resolveUserAuthor(
          guild.client,
          event.executorId
        );

      inlineFields = [
        {
          name: 'Ticket',
          value: ticketRef,
          inline: true,
        },

        {
          name: 'Reopened by',
          value:
            executorMention ||
            'Unknown',
          inline: true,
        },
      ];

      break;


    /*
    |--------------------------------------------------------------------------
    | TRANSCRIPT
    |--------------------------------------------------------------------------
    */

    case 'transcript':

      inlineFields = [
        {
          name: 'Ticket',
          value: ticketRef,
          inline: true,
        },

        {
          name: 'Creator',
          value:
            userMention ||
            'Unknown',
          inline: true,
        },
      ];

      if (channelMention) {
        inlineFields.push({
          name: 'Channel',
          value: channelMention,
          inline: true,
        });
      }

      if (
        event.metadata?.messageCount
      ) {
        inlineFields.push({
          name: 'Messages',
          value:
            String(
              event.metadata.messageCount
            ),
          inline: true,
        });
      }

      if (
        event.metadata?.duration
      ) {
        fields.push({
          name: 'Duration',
          value:
            String(
              event.metadata.duration
            ),
          inline: false,
        });
      }

      break;


    /*
    |--------------------------------------------------------------------------
    | REVIEW / FEEDBACK
    |--------------------------------------------------------------------------
    */

    case 'feedback':
    case 'review': {

      const rating =
        event.metadata?.rating ??
        event.rating;

      const comment =
        event.metadata?.comment ??
        event.comment;

      const ratingDisplay =
        formatRatingStars(
          rating
        ) ||
        'No rating';

      author =
        await resolveUserAuthor(
          guild.client,
          userId
        );

      inlineFields = [
        {
          name: 'Ticket',
          value: ticketRef,
          inline: true,
        },

        {
          name: 'Rating',
          value: ratingDisplay,
          inline: true,
        },

        {
          name: 'User',
          value:
            userMention ||
            'Unknown',
          inline: true,
        },
      ];

      if (
        ticketData?.panelType
      ) {
        inlineFields.push({
          name: 'Panel',
          value:
            ticketData.panelType === 'merch'
              ? 'Merch'
              : 'Normal',
          inline: true,
        });
      }

      if (comment) {
        fields.push({
          name: 'Comment',
          value:
            String(
              comment
            ).slice(0, 1024),
          inline: false,
        });
      }

      break;
    }


    /*
    |--------------------------------------------------------------------------
    | DEFAULT
    |--------------------------------------------------------------------------
    */

    default:

      inlineFields = [
        {
          name: 'Ticket',
          value: ticketRef,
          inline: true,
        },
      ];

      if (event.reason) {
        fields.push({
          name: 'Details',
          value:
            String(
              event.reason
            ).slice(0, 1024),
          inline: false,
        });
      }
  }

  const titlePrefix =
    event.type === 'feedback' ||
    event.type === 'review'
      ? '⭐ '
      : '';

  return buildStandardLogEmbed({
    color: style.color,
    title:
      `${titlePrefix}${style.title}`,
    inlineFields,
    fields,
    author,
    footer,
  });
}


/*
|--------------------------------------------------------------------------
| GET TICKET LOGGING CONFIG
|--------------------------------------------------------------------------
*/

export async function getTicketLoggingConfig(
  client,
  guildId,
  panelType = null
) {
  const config =
    await getGuildConfig(
      client,
      guildId
    );

  const panel =
    TICKET_LOG_CHANNELS[
      String(
        panelType || ''
      ).toLowerCase()
    ] || null;

  return {
    enabled: Boolean(
      panel?.ticket ||
      panel?.transcript ||
      panel?.review ||
      config.ticketLogsChannelId ||
      config.ticketTranscriptChannelId
    ),

    lifecycleChannelId:
      panel?.ticket ||
      config.ticketLogsChannelId ||
      null,

    transcriptChannelId:
      panel?.transcript ||
      config.ticketTranscriptChannelId ||
      null,

    reviewChannelId:
      panel?.review ||
      null,
  };
}


/*
|--------------------------------------------------------------------------
| VALIDATE LOG CHANNEL
|--------------------------------------------------------------------------
*/

export function validateLogChannel(
  channel,
  botMember
) {
  if (
    !channel ||
    channel.type !==
      ChannelType.GuildText
  ) {
    return {
      valid: false,
      error:
        'Channel must be a text channel.',
    };
  }

  const permissions =
    channel.permissionsFor(
      botMember
    );

  const requiredPermissions = [
    'SendMessages',
    'EmbedLinks',
  ];

  const missing =
    requiredPermissions.filter(
      permission =>
        !permissions?.has(
          permission
        )
    );

  if (
    missing.length > 0
  ) {
    return {
      valid: false,
      error:
        `Missing permissions: ${missing.join(', ')}`,
    };
  }

  return {
    valid: true,
  };
}


/*
|--------------------------------------------------------------------------
| EXPORT CHANNEL CONFIG
|--------------------------------------------------------------------------
*/

export {
  TICKET_LOG_CHANNELS,
};
