// loggingService.js

import {
  ChannelType,
  AuditLogEvent,
} from 'discord.js';

import {
  getGuildConfig,
  updateGuildConfig,
} from './config/guildConfig.js';

import { logger } from '../utils/logger.js';

import {
  appendContentSection,
  buildLogDescription,
  buildStandardLogEmbed,
  fieldsToLines,
  splitComparisonFields,
} from '../utils/logging/logEmbeds.js';

/*
|--------------------------------------------------------------------------
| LOG CHANNELS
|--------------------------------------------------------------------------
|
| These are the permanent destinations for the logging system.
|
*/

const LOG_CHANNELS = {
  moderation: '1542845968012021760',
  messages: '1542858198233653348',
  server: '1542860408082276392',
  members: '1542858527121604658',
  security: '1544080337649279137',
};

/*
|--------------------------------------------------------------------------
| LEGACY DESTINATIONS
|--------------------------------------------------------------------------
|
| Kept so existing commands/functions using these names do not break.
|
*/

const LOG_DESTINATIONS = [
  'audit',
  'applications',
  'reports',
];

/*
|--------------------------------------------------------------------------
| EVENT TYPES
|--------------------------------------------------------------------------
*/

const EVENT_TYPES = {
  /*
   * MODERATION
   */
  MODERATION_BAN: 'moderation.ban',
  MODERATION_KICK: 'moderation.kick',
  MODERATION_MUTE: 'moderation.mute',
  MODERATION_WARN: 'moderation.warn',
  MODERATION_PURGE: 'moderation.purge',
  MODERATION_TIMEOUT: 'moderation.timeout',
  MODERATION_UNTIMEOUT: 'moderation.untimeout',
  MODERATION_UNBAN: 'moderation.unban',
  MODERATION_LOCK: 'moderation.lock',
  MODERATION_UNLOCK: 'moderation.unlock',
  MODERATION_DM: 'moderation.dm',
  MODERATION_CONFIG: 'moderation.config',

  /*
   * LEVELING
   */
  LEVELING_LEVELUP: 'leveling.levelup',
  LEVELING_MILESTONE: 'leveling.milestone',

  /*
   * MESSAGES
   */
  MESSAGE_DELETE: 'message.delete',
  MESSAGE_EDIT: 'message.edit',
  MESSAGE_BULK_DELETE: 'message.bulkdelete',

  /*
   * ROLES
   */
  ROLE_CREATE: 'role.create',
  ROLE_DELETE: 'role.delete',
  ROLE_UPDATE: 'role.update',

  /*
   * CHANNELS
   */
  CHANNEL_CREATE: 'channel.create',
  CHANNEL_DELETE: 'channel.delete',
  CHANNEL_UPDATE: 'channel.update',

  /*
   * CATEGORIES
   */
  CATEGORY_CREATE: 'category.create',
  CATEGORY_DELETE: 'category.delete',
  CATEGORY_UPDATE: 'category.update',

  /*
   * MEMBERS
   */
  MEMBER_JOIN: 'member.join',
  MEMBER_LEAVE: 'member.leave',
  MEMBER_NAME_CHANGE: 'member.namechange',

  /*
   * WEBHOOKS
   */
  WEBHOOK_CREATE: 'webhook.create',
  WEBHOOK_DELETE: 'webhook.delete',
  WEBHOOK_UPDATE: 'webhook.update',

  /*
   * INTEGRATIONS
   */
  INTEGRATION_CREATE: 'integration.create',
  INTEGRATION_DELETE: 'integration.delete',
  INTEGRATION_UPDATE: 'integration.update',

  /*
   * REACTION ROLES
   */
  REACTION_ROLE_ADD: 'reactionrole.add',
  REACTION_ROLE_REMOVE: 'reactionrole.remove',
  REACTION_ROLE_CREATE: 'reactionrole.create',
  REACTION_ROLE_DELETE: 'reactionrole.delete',
  REACTION_ROLE_UPDATE: 'reactionrole.update',

  /*
   * GIVEAWAYS
   */
  GIVEAWAY_CREATE: 'giveaway.create',
  GIVEAWAY_WINNER: 'giveaway.winner',
  GIVEAWAY_REROLL: 'giveaway.reroll',
  GIVEAWAY_DELETE: 'giveaway.delete',

  /*
   * COUNTERS
   */
  COUNTER_UPDATE: 'counter.update',
  COUNTER_CONFIG: 'counter.config',

  /*
   * APPLICATIONS
   */
  APPLICATION_SUBMIT: 'application.submit',
  APPLICATION_REVIEW: 'application.review',

  /*
   * REPORTS
   */
  REPORT_FILE: 'report.file',
};

/*
|--------------------------------------------------------------------------
| EVENT COLORS
|--------------------------------------------------------------------------
*/

const EVENT_COLORS = {
  /*
   * Moderation
   */
  'moderation.ban': 0x721919,
  'moderation.kick': 0xFFA500,
  'moderation.mute': 0xF1C40F,
  'moderation.warn': 0xFEE75C,
  'moderation.purge': 0xE67E22,
  'moderation.timeout': 0xF1C40F,
  'moderation.untimeout': 0x2ECC71,
  'moderation.unban': 0x3498DB,
  'moderation.lock': 0xE67E22,
  'moderation.unlock': 0x2ECC71,
  'moderation.dm': 0x3498DB,
  'moderation.config': 0x5865F2,

  /*
   * Leveling
   */
  'leveling.levelup': 0x00FF00,
  'leveling.milestone': 0xFFD700,

  /*
   * Messages
   */
  'message.delete': 0x8B0000,
  'message.edit': 0xFFA500,
  'message.bulkdelete': 0xFF0000,

  /*
   * Roles
   */
  'role.create': 0x2ECC71,
  'role.delete': 0xE74C3C,
  'role.update': 0x3498DB,

  /*
   * Channels
   */
  'channel.create': 0x2ECC71,
  'channel.delete': 0xE74C3C,
  'channel.update': 0x3498DB,

  /*
   * Categories
   */
  'category.create': 0x2ECC71,
  'category.delete': 0xE74C3C,
  'category.update': 0x3498DB,

  /*
   * Members
   */
  'member.join': 0x2ECC71,
  'member.leave': 0xE74C3C,
  'member.namechange': 0x3498DB,

  /*
   * Webhooks
   */
  'webhook.create': 0x2ECC71,
  'webhook.delete': 0xE74C3C,
  'webhook.update': 0x3498DB,

  /*
   * Integrations
   */
  'integration.create': 0x2ECC71,
  'integration.delete': 0xE74C3C,
  'integration.update': 0x3498DB,

  /*
   * Reaction roles
   */
  'reactionrole.add': 0x2ECC71,
  'reactionrole.remove': 0xE74C3C,
  'reactionrole.create': 0x3498DB,
  'reactionrole.delete': 0x8B0000,
  'reactionrole.update': 0xFFA500,

  /*
   * Giveaways
   */
  'giveaway.create': 0x57F287,
  'giveaway.winner': 0xFEE75C,
  'giveaway.reroll': 0x3498DB,
  'giveaway.delete': 0xE74C3C,

  /*
   * Counters
   */
  'counter.update': 0x0099FF,
  'counter.config': 0x5865F2,

  /*
   * Applications
   */
  'application.submit': 0x5865F2,
  'application.review': 0x57F287,

  /*
   * Reports
   */
  'report.file': 0xED4245,
};

/*
|--------------------------------------------------------------------------
| EVENT ICONS
|--------------------------------------------------------------------------
*/

const EVENT_ICONS = {
  /*
   * Moderation
   */
  'moderation.ban': '🔨',
  'moderation.kick': '👢',
  'moderation.mute': '🔇',
  'moderation.warn': '⚠️',
  'moderation.purge': '🗑️',
  'moderation.timeout': '⏳',
  'moderation.untimeout': '✅',
  'moderation.unban': '🔓',
  'moderation.lock': '🔒',
  'moderation.unlock': '🔓',
  'moderation.dm': '✉️',
  'moderation.config': '⚙️',

  /*
   * Leveling
   */
  'leveling.levelup': '📈',
  'leveling.milestone': '🏆',

  /*
   * Messages
   */
  'message.delete': '❌',
  'message.edit': '✏️',
  'message.bulkdelete': '🗑️',

  /*
   * Roles
   */
  'role.create': '➕',
  'role.delete': '➖',
  'role.update': '🔄',

  /*
   * Channels
   */
  'channel.create': '➕',
  'channel.delete': '➖',
  'channel.update': '🔄',

  /*
   * Categories
   */
  'category.create': '➕',
  'category.delete': '➖',
  'category.update': '🔄',

  /*
   * Members
   */
  'member.join': '👋',
  'member.leave': '👋',
  'member.namechange': '🏷️',

  /*
   * Webhooks
   */
  'webhook.create': '🔗',
  'webhook.delete': '🔗',
  'webhook.update': '🔄',

  /*
   * Integrations
   */
  'integration.create': '🔌',
  'integration.delete': '🔌',
  'integration.update': '🔄',

  /*
   * Reaction roles
   */
  'reactionrole.add': '✅',
  'reactionrole.remove': '❌',
  'reactionrole.create': '🎭',
  'reactionrole.delete': '🗑️',
  'reactionrole.update': '🔄',

  /*
   * Giveaways
   */
  'giveaway.create': '🎁',
  'giveaway.winner': '🎉',
  'giveaway.reroll': '🔄',
  'giveaway.delete': '🗑️',

  /*
   * Counters
   */
  'counter.update': '📊',
  'counter.config': '⚙️',

  /*
   * Applications
   */
  'application.submit': '📝',
  'application.review': '📋',

  /*
   * Reports
   */
  'report.file': '🚨',
};

/*
|--------------------------------------------------------------------------
| EVENT DESTINATION ROUTING
|--------------------------------------------------------------------------
|
| IMPORTANT:
| This is what decides which channel receives each event.
|
*/

const EVENT_DESTINATIONS = {
  /*
   * MODERATION
   */
  'moderation.ban': 'moderation',
  'moderation.kick': 'moderation',
  'moderation.mute': 'moderation',
  'moderation.warn': 'moderation',
  'moderation.purge': 'moderation',
  'moderation.timeout': 'moderation',
  'moderation.untimeout': 'moderation',
  'moderation.unban': 'moderation',
  'moderation.lock': 'moderation',
  'moderation.unlock': 'moderation',
  'moderation.dm': 'moderation',
  'moderation.config': 'moderation',

  /*
   * REPORTS
   *
   * Reports intentionally go into moderation logs.
   */
  'report.file': 'moderation',

  /*
   * MESSAGES
   */
  'message.delete': 'messages',
  'message.edit': 'messages',
  'message.bulkdelete': 'messages',

  /*
   * ROLES
   */
  'role.create': 'server',
  'role.delete': 'server',
  'role.update': 'server',

  /*
   * CHANNELS
   */
  'channel.create': 'server',
  'channel.delete': 'server',
  'channel.update': 'server',

  /*
   * CATEGORIES
   */
  'category.create': 'server',
  'category.delete': 'server',
  'category.update': 'server',

  /*
   * MEMBERS
   */
  'member.join': 'members',
  'member.leave': 'members',
  'member.namechange': 'members',

  /*
   * WEBHOOKS
   */
  'webhook.create': 'security',
  'webhook.delete': 'security',
  'webhook.update': 'security',

  /*
   * INTEGRATIONS
   */
  'integration.create': 'security',
  'integration.delete': 'security',
  'integration.update': 'security',

  /*
   * These remain on the old audit destination
   * so existing features don't break.
   */
  'leveling.levelup': 'audit',
  'leveling.milestone': 'audit',

  'reactionrole.add': 'audit',
  'reactionrole.remove': 'audit',
  'reactionrole.create': 'audit',
  'reactionrole.delete': 'audit',
  'reactionrole.update': 'audit',

  'giveaway.create': 'audit',
  'giveaway.winner': 'audit',
  'giveaway.reroll': 'audit',
  'giveaway.delete': 'audit',

  'counter.update': 'audit',
  'counter.config': 'audit',

  'application.submit': 'applications',
  'application.review': 'applications',
};

/*
|--------------------------------------------------------------------------
| AUDIT LOG EVENTS
|--------------------------------------------------------------------------
|
| Used by the event handlers for webhook/integration changes.
|
*/

const AUDIT_LOG_EVENT_TYPES = {
  [AuditLogEvent.WebhookCreate]: 'webhook.create',
  [AuditLogEvent.WebhookUpdate]: 'webhook.update',
  [AuditLogEvent.WebhookDelete]: 'webhook.delete',

  [AuditLogEvent.IntegrationCreate]: 'integration.create',
  [AuditLogEvent.IntegrationUpdate]: 'integration.update',
  [AuditLogEvent.IntegrationDelete]: 'integration.delete',
};

/*
|--------------------------------------------------------------------------
| IGNORED CHANNEL CHANGES
|--------------------------------------------------------------------------
|
| Discord reports "position" as a channel update when channels/categories
| are moved around.
|
| We DO NOT log those.
|
*/

const IGNORED_CHANNEL_CHANGES = new Set([
  'position',
]);

/*
|--------------------------------------------------------------------------
| TICKET DETECTION
|--------------------------------------------------------------------------
|
| General channel/category logging should not log ticket activity.
|
*/

function isTicketChannel(channel) {
  if (!channel) {
    return false;
  }

  const name = String(channel.name || '').toLowerCase();

  /*
   * Common ticket channel naming.
   */
  if (
    name.startsWith('ticket-') ||
    name.startsWith('ticket_') ||
    name === 'ticket' ||
    name.includes('-ticket') ||
    name.includes('ticket-')
  ) {
    return true;
  }

  /*
   * If your ticket system marks channels using a topic.
   */
  const topic = String(channel.topic || '').toLowerCase();

  if (
    topic.includes('ticket') ||
    topic.includes('ticket-id') ||
    topic.includes('ticketid')
  ) {
    return true;
  }

  return false;
}

/*
|--------------------------------------------------------------------------
| GET LOG CHANNEL
|--------------------------------------------------------------------------
*/

export function resolveLogChannel(config, destination) {
  /*
   * Hard-coded channels.
   */
  if (destination === 'moderation') {
    return LOG_CHANNELS.moderation;
  }

  if (destination === 'messages') {
    return LOG_CHANNELS.messages;
  }

  if (destination === 'server') {
    return LOG_CHANNELS.server;
  }

  if (destination === 'members') {
    return LOG_CHANNELS.members;
  }

  if (destination === 'security') {
    return LOG_CHANNELS.security;
  }

  /*
   * Legacy configuration destinations.
   */
  const channels = config?.logging?.channels || {};

  if (destination && channels[destination]) {
    return channels[destination];
  }

  if (destination === 'audit') {
    return (
      channels.audit ??
      config?.logging?.channelId ??
      config?.logChannelId ??
      null
    );
  }

  return channels[destination] ?? null;
}

/*
|--------------------------------------------------------------------------
| IGNORE LIST
|--------------------------------------------------------------------------
*/

export function getIgnoreList(config) {
  return (
    config?.logging?.ignore ??
    config?.logIgnore ??
    {
      users: [],
      channels: [],
    }
  );
}

/*
|--------------------------------------------------------------------------
| EVENT ENABLED
|--------------------------------------------------------------------------
*/

export function isEventEnabled(config, eventType) {
  /*
   * If logging has explicitly been disabled, respect that.
   */
  if (config?.logging?.enabled === false) {
    return false;
  }

  if (!eventType || typeof eventType !== 'string') {
    return false;
  }

  const category = eventType.split('.')[0];

  const enabledEvents =
    config?.logging?.enabledEvents || {};

  if (enabledEvents[eventType] === false) {
    return false;
  }

  if (enabledEvents[`${category}.*`] === false) {
    return false;
  }

  return true;
}

/*
|--------------------------------------------------------------------------
| GET CHANNEL FOR EVENT
|--------------------------------------------------------------------------
*/

function getLogChannelForEvent(
  config,
  eventType,
  overrideChannelId = null,
) {
  /*
   * Explicit override always wins.
   */
  if (overrideChannelId) {
    return overrideChannelId;
  }

  const destination =
    EVENT_DESTINATIONS[eventType];

  /*
   * Unknown events use the legacy audit channel.
   */
  if (!destination) {
    return resolveLogChannel(
      config,
      'audit',
    );
  }

  return resolveLogChannel(
    config,
    destination,
  );
}

/*
|--------------------------------------------------------------------------
| LOG EVENT
|--------------------------------------------------------------------------
*/

export async function logEvent({
  client,
  guildId,
  eventType,
  data = {},
  attachments = [],
  content = null,
  channelId: overrideChannelId = null,
}) {
  try {
    const guild =
      client.guilds.cache.get(guildId) ||
      await client.guilds
        .fetch(guildId)
        .catch(() => null);

    if (!guild) {
      logger.warn(
        `logEvent: Guild not found: ${guildId}`,
      );

      return null;
    }

    const config =
      await getGuildConfig(
        client,
        guildId,
      );

    const ignore =
      getIgnoreList(config);

    /*
     * Ignore users.
     */
    if (
      data?.userId &&
      ignore.users?.includes(
        data.userId,
      )
    ) {
      return null;
    }

    /*
     * Ignore channels.
     */
    if (
      data?.channelId &&
      ignore.channels?.includes(
        data.channelId,
      )
    ) {
      return null;
    }

    /*
     * Don't log ticket channels in the
     * general server structure logger.
     */
    if (
      (
        eventType === EVENT_TYPES.CHANNEL_CREATE ||
        eventType === EVENT_TYPES.CHANNEL_UPDATE ||
        eventType === EVENT_TYPES.CHANNEL_DELETE ||
        eventType === EVENT_TYPES.CATEGORY_CREATE ||
        eventType === EVENT_TYPES.CATEGORY_UPDATE ||
        eventType === EVENT_TYPES.CATEGORY_DELETE
      ) &&
      data?.channel &&
      isTicketChannel(data.channel)
    ) {
      return null;
    }

    /*
     * Ignore channel position-only updates.
     */
    if (
      eventType === EVENT_TYPES.CHANNEL_UPDATE ||
      eventType === EVENT_TYPES.CATEGORY_UPDATE
    ) {
      if (
        data?.changes &&
        Array.isArray(data.changes) &&
        data.changes.length > 0
      ) {
        const meaningfulChanges =
          data.changes.filter(
            change =>
              !IGNORED_CHANNEL_CHANGES.has(
                change.key,
              ),
          );

        if (
          meaningfulChanges.length === 0
        ) {
          return null;
        }
      }

      if (
        data?.onlyPositionChange === true
      ) {
        return null;
      }
    }

    if (
      !isEventEnabled(
        config,
        eventType,
      )
    ) {
      return null;
    }

    const logChannelId =
      getLogChannelForEvent(
        config,
        eventType,
        overrideChannelId,
      );

    if (!logChannelId) {
      logger.warn(
        `logEvent: No log channel configured for ${eventType}`,
      );

      return null;
    }

    const channel =
      guild.channels.cache.get(
        logChannelId,
      ) ||
      await guild.channels
        .fetch(logChannelId)
        .catch(() => null);

    if (
      !channel ||
      (
        channel.type !==
          ChannelType.GuildText &&
        channel.type !==
          ChannelType.GuildAnnouncement
      )
    ) {
      logger.warn(
        `logEvent: Invalid log channel ${logChannelId} for guild ${guildId}`,
      );

      return null;
    }

    const me =
      guild.members.me ||
      await guild.members
        .fetch(client.user.id)
        .catch(() => null);

    const permissions =
      channel.permissionsFor(me);

    if (
      !permissions ||
      !permissions.has([
        'SendMessages',
        'EmbedLinks',
      ])
    ) {
      logger.warn(
        `logEvent: Missing permissions in channel ${logChannelId}`,
      );

      return null;
    }

    const embed =
      createLogEmbed(
        guild,
        eventType,
        data,
      );

    const messageOptions = {
      embeds: [embed],
    };

    if (content) {
      messageOptions.content =
        content;
    }

    if (
      Array.isArray(attachments) &&
      attachments.length > 0
    ) {
      messageOptions.files =
        attachments;
    }

    const sent =
      await channel.send(
        messageOptions,
      );

    logger.info(
      `Event logged: ${eventType} in guild ${guildId}`,
    );

    return sent;
  } catch (error) {
    logger.error(
      'Error in logEvent:',
      error,
    );

    return null;
  }
}

/*
|--------------------------------------------------------------------------
| CREATE LOG EMBED
|--------------------------------------------------------------------------
*/

function createLogEmbed(
  guild,
  eventType,
  data,
) {
  const color =
    data.color ??
    EVENT_COLORS[eventType] ??
    0x0099FF;

  const icon =
    EVENT_ICONS[eventType] ||
    '📌';

  const title =
    data.title ||
    `${icon} ${formatEventType(eventType)}`;

  const inlineFields = [];

  let description =
    data.description || '';

  /*
   * Lines.
   */
  if (data.lines?.length) {
    description =
      buildLogDescription({
        headline:
          data.headline ||
          description ||
          undefined,

        lines:
          data.lines,

        quoted:
          data.quoted !== false,

        meta:
          data.meta,
      });

    if (data.fields?.length) {
      const {
        before,
        after,
      } =
        splitComparisonFields(
          data.fields,
        );

      if (before !== null) {
        inlineFields.push({
          name: 'Before',
          value: before,
          inline: true,
        });
      }

      if (after !== null) {
        inlineFields.push({
          name: 'After',
          value: after,
          inline: true,
        });
      }
    }
  }

  /*
   * Fields.
   */
  else if (data.fields?.length) {
    const {
      before,
      after,
      rest,
    } =
      splitComparisonFields(
        data.fields,
      );

    if (
      before !== null ||
      after !== null
    ) {
      const metaLines =
        fieldsToLines(rest);

      description =
        buildLogDescription({
          headline:
            description ||
            undefined,

          lines:
            metaLines,

          quoted: true,
        });

      if (before !== null) {
        inlineFields.push({
          name: 'Before',
          value: before,
          inline: true,
        });
      }

      if (after !== null) {
        inlineFields.push({
          name: 'After',
          value: after,
          inline: true,
        });
      }
    } else {
      description =
        buildLogDescription({
          headline:
            description ||
            undefined,

          lines:
            fieldsToLines(
              data.fields,
            ),

          quoted:
            data.quoted ??
            !description,
        });
    }
  }

  /*
   * Metadata.
   */
  else if (data.meta?.length) {
    description =
      buildLogDescription({
        headline:
          description ||
          undefined,

        meta:
          data.meta,
      });
  }

  /*
   * Content section.
   */
  if (data.section?.body) {
    description =
      appendContentSection(
        description,
        data.section.title ||
          'Message',
        data.section.body,
      );
  }

  /*
   * Inline fields.
   */
  if (data.inlineFields?.length) {
    inlineFields.push(
      ...data.inlineFields,
    );
  }

  return buildStandardLogEmbed({
    color,
    title,

    description:
      description ||
      undefined,

    thumbnail:
      data.thumbnail ||
      undefined,

    inlineFields,

    fields:
      data.blockFields ||
      [],

    author:
      data.author ||
      null,

    timestamp: true,

    footer:
      data.footer || {
        text: guild.name,
        iconURL:
          guild.iconURL({
            dynamic: true,
          }) ||
          undefined,
      },
  });
}

/*
|--------------------------------------------------------------------------
| FORMAT EVENT TYPE
|--------------------------------------------------------------------------
*/

function formatEventType(
  eventType,
) {
  if (
    !eventType ||
    typeof eventType !== 'string'
  ) {
    return 'Unknown Event';
  }

  return eventType
    .split('.')
    .map(
      part =>
        part.charAt(0).toUpperCase() +
        part.slice(1),
    )
    .join(' ');
}

/*
|--------------------------------------------------------------------------
| AUDIT LOG EVENT -> EVENT TYPE
|--------------------------------------------------------------------------
*/

export function getEventTypeFromAuditLog(
  auditLogEntry,
) {
  if (!auditLogEntry) {
    return null;
  }

  return (
    AUDIT_LOG_EVENT_TYPES[
      auditLogEntry.action
    ] || null
  );
}

/*
|--------------------------------------------------------------------------
| LOG AUDIT LOG ENTRY
|--------------------------------------------------------------------------
|
| This is useful for webhook/integration logging.
|
*/

export async function logAuditLogEntry({
  client,
  guild,
  entry,
}) {
  try {
    if (!guild || !entry) {
      return null;
    }

    const eventType =
      getEventTypeFromAuditLog(
        entry,
      );

    if (!eventType) {
      return null;
    }

    const executor =
      entry.executor;

    const target =
      entry.target;

    const changes =
      Array.isArray(entry.changes)
        ? entry.changes
        : [];

    /*
     * Convert Discord audit changes into
     * readable fields.
     */
    const fields = [];

    if (executor) {
      fields.push({
        name: 'Executor',
        value:
          `${executor.tag || executor.username || 'Unknown'}\n` +
          `\`${executor.id}\``,
      });
    }

    if (target) {
      const targetName =
        target.name ||
        target.tag ||
        target.username ||
        target.id ||
        'Unknown';

      fields.push({
        name: 'Target',
        value:
          `${targetName}\n` +
          `\`${target.id || 'Unknown'}\``,
      });
    }

    for (const change of changes) {
      if (!change) {
        continue;
      }

      /*
       * Never show position changes.
       */
      if (
        IGNORED_CHANNEL_CHANGES.has(
          change.key,
        )
      ) {
        continue;
      }

      const oldValue =
        formatAuditValue(
          change.old,
        );

      const newValue =
        formatAuditValue(
          change.new,
        );

      if (
        oldValue === 'Unknown' &&
        newValue === 'Unknown'
      ) {
        continue;
      }

      fields.push({
        name:
          formatAuditKey(
            change.key,
          ),

        value:
          `Before: ${oldValue}\n` +
          `After: ${newValue}`,
      });
    }

    /*
     * Special handling for integration/webhook
     * audit events.
     */
    let title;

    if (
      eventType.startsWith(
        'webhook.',
      )
    ) {
      title =
        `${EVENT_ICONS[eventType]} ` +
        `${formatEventType(eventType)}`;
    } else {
      title =
        `${EVENT_ICONS[eventType]} ` +
        `${formatEventType(eventType)}`;
    }

    return await logEvent({
      client,
      guildId: guild.id,
      eventType,

      data: {
        title,
        description:
          `${formatEventType(eventType)} detected.`,

        fields,
      },
    });
  } catch (error) {
    logger.error(
      'Error logging audit log entry:',
      error,
    );

    return null;
  }
}

/*
|--------------------------------------------------------------------------
| FORMAT AUDIT VALUE
|--------------------------------------------------------------------------
*/

function formatAuditValue(
  value,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return 'None';
  }

  if (
    typeof value === 'object'
  ) {
    try {
      const json =
        JSON.stringify(value);

      if (
        json &&
        json.length > 900
      ) {
        return (
          json.slice(0, 897) +
          '...'
        );
      }

      return json;
    } catch {
      return String(value);
    }
  }

  const text =
    String(value);

  if (text.length > 900) {
    return (
      text.slice(0, 897) +
      '...'
    );
  }

  return text;
}

/*
|--------------------------------------------------------------------------
| FORMAT AUDIT KEY
|--------------------------------------------------------------------------
*/

function formatAuditKey(
  key,
) {
  if (!key) {
    return 'Changed';
  }

  return String(key)
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(
      /\b\w/g,
      char =>
        char.toUpperCase(),
    );
}

/*
|--------------------------------------------------------------------------
| LOGGING STATUS
|--------------------------------------------------------------------------
*/

export async function getLoggingStatus(
  client,
  guildId,
) {
  const config =
    await getGuildConfig(
      client,
      guildId,
    );

  const logging =
    config.logging || {};

  return {
    enabled:
      logging.enabled !== false,

    /*
     * Show the new fixed channels.
     */
    channels: {
      moderation:
        LOG_CHANNELS.moderation,

      messages:
        LOG_CHANNELS.messages,

      server:
        LOG_CHANNELS.server,

      members:
        LOG_CHANNELS.members,

      security:
        LOG_CHANNELS.security,

      /*
       * Keep legacy destinations available.
       */
      audit:
        logging.channels?.audit ??
        null,

      applications:
        logging.channels?.applications ??
        null,

      reports:
        logging.channels?.reports ??
        null,
    },

    channelId:
      LOG_CHANNELS.server,

    ignore:
      getIgnoreList(config),

    enabledEvents:
      logging.enabledEvents ||
      {},

    allEventTypes:
      EVENT_TYPES,
  };
}

/*
|--------------------------------------------------------------------------
| TOGGLE EVENT LOGGING
|--------------------------------------------------------------------------
*/

export async function toggleEventLogging(
  client,
  guildId,
  eventTypes,
  enabled,
) {
  try {
    const config =
      await getGuildConfig(
        client,
        guildId,
      );

    const logging = {
      ...config.logging,

      enabledEvents: {
        ...(
          config.logging
            ?.enabledEvents ||
          {}
        ),
      },
    };

    const types =
      Array.isArray(eventTypes)
        ? eventTypes
        : [eventTypes];

    types.forEach(type => {
      if (
        typeof type !== 'string'
      ) {
        return;
      }

      if (
        type.endsWith('.*')
      ) {
        const category =
          type.replace(
            '.*',
            '',
          );

        const matchingTypes =
          Object.values(
            EVENT_TYPES,
          ).filter(
            eventType =>
              eventType.startsWith(
                `${category}.`,
              ),
          );

        matchingTypes.forEach(
          eventType => {
            logging.enabledEvents[
              eventType
            ] = enabled;
          },
        );

        logging.enabledEvents[
          type
        ] = enabled;
      } else {
        logging.enabledEvents[
          type
        ] = enabled;
      }
    });

    await updateGuildConfig(
      client,
      guildId,
      { logging },
    );

    return true;
  } catch (error) {
    logger.error(
      'Error toggling event logging:',
      error,
    );

    return false;
  }
}

/*
|--------------------------------------------------------------------------
| SET LOG CHANNEL
|--------------------------------------------------------------------------
|
| Legacy compatibility.
|
| The five new logging destinations are fixed in code and cannot
| accidentally be changed by an old configuration command.
|
*/

export async function setLogChannel(
  client,
  guildId,
  destination,
  channelId,
) {
  /*
   * New destinations are intentionally fixed.
   */
  if (
    [
      'moderation',
      'messages',
      'server',
      'members',
      'security',
    ].includes(destination)
  ) {
    logger.info(
      `Ignoring dynamic log channel change for fixed destination "${destination}". ` +
      `Fixed channel: ${LOG_CHANNELS[destination]}`,
    );

    return true;
  }

  if (
    !LOG_DESTINATIONS.includes(
      destination,
    )
  ) {
    throw new Error(
      `Invalid log destination: ${destination}`,
    );
  }

  try {
    const config =
      await getGuildConfig(
        client,
        guildId,
      );

    const logging = {
      ...config.logging,

      channels: {
        ...(
          config.logging
            ?.channels ||
          {}
        ),

        [destination]:
          channelId,
      },
    };

    if (channelId) {
      logging.enabled = true;
    }

    await updateGuildConfig(
      client,
      guildId,
      { logging },
    );

    return true;
  } catch (error) {
    logger.error(
      'Error setting log channel:',
      error,
    );

    return false;
  }
}

/*
|--------------------------------------------------------------------------
| LEGACY SET LOGGING CHANNEL
|--------------------------------------------------------------------------
*/

export async function setLoggingChannel(
  client,
  guildId,
  channelId,
) {
  return setLogChannel(
    client,
    guildId,
    'audit',
    channelId,
  );
}

/*
|--------------------------------------------------------------------------
| ENABLE / DISABLE LOGGING
|--------------------------------------------------------------------------
*/

export async function setLoggingEnabled(
  client,
  guildId,
  enabled,
) {
  try {
    const config =
      await getGuildConfig(
        client,
        guildId,
      );

    const logging = {
      ...config.logging,
      enabled,
    };

    await updateGuildConfig(
      client,
      guildId,
      { logging },
    );

    return true;
  } catch (error) {
    logger.error(
      'Error setting logging enabled:',
      error,
    );

    return false;
  }
}

/*
|--------------------------------------------------------------------------
| IGNORE LIST
|--------------------------------------------------------------------------
*/

export async function updateIgnoreList(
  client,
  guildId,
  {
    action,
    type,
    id,
  },
) {
  try {
    const config =
      await getGuildConfig(
        client,
        guildId,
      );

    const ignore = {
      ...getIgnoreList(config),
    };

    const listKey =
      type === 'user'
        ? 'users'
        : 'channels';

    const current = [
      ...(ignore[listKey] || []),
    ];

    if (
      action === 'add' &&
      !current.includes(id)
    ) {
      current.push(id);
    } else if (
      action === 'remove'
    ) {
      const index =
        current.indexOf(id);

      if (index !== -1) {
        current.splice(index, 1);
      }
    }

    ignore[listKey] =
      current;

    const logging = {
      ...config.logging,
      ignore,
    };

    await updateGuildConfig(
      client,
      guildId,
      { logging },
    );

    return true;
  } catch (error) {
    logger.error(
      'Error updating ignore list:',
      error,
    );

    return false;
  }
}

/*
|--------------------------------------------------------------------------
| APPLICATION LOG CHANNEL
|--------------------------------------------------------------------------
*/

export function resolveApplicationLogChannel(
  config,
  roleSettings = {},
  appSettings = {},
) {
  return (
    roleSettings.logChannelId ||
    config?.logging?.channels
      ?.applications ||
    appSettings.logChannelId ||
    null
  );
}

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

export {
  EVENT_TYPES,
  EVENT_COLORS,
  EVENT_ICONS,
  LOG_DESTINATIONS,
  LOG_CHANNELS,
  EVENT_DESTINATIONS,
  AUDIT_LOG_EVENT_TYPES,
};
