// src/services/loggingService.js

import {
  AuditLogEvent,
  ChannelType,
} from 'discord.js';

import { getGuildConfig, updateGuildConfig } from './config/guildConfig.js';
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
| FIXED LOG CHANNELS
|--------------------------------------------------------------------------
*/

export const LOG_CHANNELS = {
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
  // Moderation
  MODERATION_BAN: 'moderation.ban',
  MODERATION_UNBAN: 'moderation.unban',
  MODERATION_KICK: 'moderation.kick',
  MODERATION_WARN: 'moderation.warn',
  MODERATION_TIMEOUT: 'moderation.timeout',
  MODERATION_UNTIMEOUT: 'moderation.untimeout',
  MODERATION_MUTE: 'moderation.mute',
  MODERATION_PURGE: 'moderation.purge',
  MODERATION_LOCK: 'moderation.lock',
  MODERATION_UNLOCK: 'moderation.unlock',
  MODERATION_DM: 'moderation.dm',
  MODERATION_CONFIG: 'moderation.config',

  // Messages
  MESSAGE_DELETE: 'message.delete',
  MESSAGE_EDIT: 'message.edit',
  MESSAGE_BULK_DELETE: 'message.bulkdelete',

  // Roles
  ROLE_CREATE: 'role.create',
  ROLE_UPDATE: 'role.update',
  ROLE_DELETE: 'role.delete',

  // Channels
  CHANNEL_CREATE: 'channel.create',
  CHANNEL_UPDATE: 'channel.update',
  CHANNEL_DELETE: 'channel.delete',

  // Categories
  CATEGORY_CREATE: 'category.create',
  CATEGORY_UPDATE: 'category.update',
  CATEGORY_DELETE: 'category.delete',

  // Members
  MEMBER_JOIN: 'member.join',
  MEMBER_LEAVE: 'member.leave',
  MEMBER_NAME_CHANGE: 'member.namechange',

  // Webhooks
  WEBHOOK_CREATE: 'webhook.create',
  WEBHOOK_UPDATE: 'webhook.update',
  WEBHOOK_DELETE: 'webhook.delete',

  // Integrations
  INTEGRATION_CREATE: 'integration.create',
  INTEGRATION_UPDATE: 'integration.update',
  INTEGRATION_DELETE: 'integration.delete',

  // Existing systems
  REACTION_ROLE_ADD: 'reactionrole.add',
  REACTION_ROLE_REMOVE: 'reactionrole.remove',
  REACTION_ROLE_CREATE: 'reactionrole.create',
  REACTION_ROLE_DELETE: 'reactionrole.delete',
  REACTION_ROLE_UPDATE: 'reactionrole.update',

  GIVEAWAY_CREATE: 'giveaway.create',
  GIVEAWAY_WINNER: 'giveaway.winner',
  GIVEAWAY_REROLL: 'giveaway.reroll',
  GIVEAWAY_DELETE: 'giveaway.delete',

  LEVELING_LEVELUP: 'leveling.levelup',
  LEVELING_MILESTONE: 'leveling.milestone',

  COUNTER_UPDATE: 'counter.update',
  COUNTER_CONFIG: 'counter.config',

  APPLICATION_SUBMIT: 'application.submit',
  APPLICATION_REVIEW: 'application.review',

  REPORT_FILE: 'report.file',
};

/*
|--------------------------------------------------------------------------
| EVENT -> DESTINATION
|--------------------------------------------------------------------------
*/

const EVENT_DESTINATIONS = {
  // Moderation
  'moderation.ban': 'moderation',
  'moderation.unban': 'moderation',
  'moderation.kick': 'moderation',
  'moderation.warn': 'moderation',
  'moderation.timeout': 'moderation',
  'moderation.untimeout': 'moderation',
  'moderation.mute': 'moderation',
  'moderation.purge': 'moderation',
  'moderation.lock': 'moderation',
  'moderation.unlock': 'moderation',
  'moderation.dm': 'moderation',
  'moderation.config': 'moderation',

  // Messages
  'message.delete': 'messages',
  'message.edit': 'messages',
  'message.bulkdelete': 'messages',

  // Roles
  'role.create': 'server',
  'role.update': 'server',
  'role.delete': 'server',

  // Channels
  'channel.create': 'server',
  'channel.update': 'server',
  'channel.delete': 'server',

  // Categories
  'category.create': 'server',
  'category.update': 'server',
  'category.delete': 'server',

  // Members
  'member.join': 'members',
  'member.leave': 'members',
  'member.namechange': 'members',

  // Security
  'webhook.create': 'security',
  'webhook.update': 'security',
  'webhook.delete': 'security',

  'integration.create': 'security',
  'integration.update': 'security',
  'integration.delete': 'security',

  // Existing
  'reactionrole.add': 'audit',
  'reactionrole.remove': 'audit',
  'reactionrole.create': 'audit',
  'reactionrole.delete': 'audit',
  'reactionrole.update': 'audit',

  'giveaway.create': 'audit',
  'giveaway.winner': 'audit',
  'giveaway.reroll': 'audit',
  'giveaway.delete': 'audit',

  'leveling.levelup': 'audit',
  'leveling.milestone': 'audit',

  'counter.update': 'audit',
  'counter.config': 'audit',

  'application.submit': 'applications',
  'application.review': 'applications',

  'report.file': 'moderation',
};

/*
|--------------------------------------------------------------------------
| COLORS
|--------------------------------------------------------------------------
*/

const EVENT_COLORS = {
  // Moderation
  'moderation.ban': 0x721919,
  'moderation.unban': 0x3498DB,
  'moderation.kick': 0xE67E22,
  'moderation.warn': 0xFEE75C,
  'moderation.timeout': 0xF1C40F,
  'moderation.untimeout': 0x2ECC71,
  'moderation.mute': 0xF1C40F,
  'moderation.purge': 0xE67E22,
  'moderation.lock': 0xE67E22,
  'moderation.unlock': 0x2ECC71,
  'moderation.dm': 0x3498DB,
  'moderation.config': 0x5865F2,

  // Messages
  'message.delete': 0x8B0000,
  'message.edit': 0xFFA500,
  'message.bulkdelete': 0xFF0000,

  // Server
  'role.create': 0x2ECC71,
  'role.update': 0x3498DB,
  'role.delete': 0xE74C3C,

  'channel.create': 0x2ECC71,
  'channel.update': 0x3498DB,
  'channel.delete': 0xE74C3C,

  'category.create': 0x2ECC71,
  'category.update': 0x3498DB,
  'category.delete': 0xE74C3C,

  // Members
  'member.join': 0x2ECC71,
  'member.leave': 0xE74C3C,
  'member.namechange': 0x3498DB,

  // Security
  'webhook.create': 0x2ECC71,
  'webhook.update': 0xFFA500,
  'webhook.delete': 0xE74C3C,

  'integration.create': 0x2ECC71,
  'integration.update': 0xFFA500,
  'integration.delete': 0xE74C3C,

  // Existing
  'reactionrole.add': 0x2ECC71,
  'reactionrole.remove': 0xE74C3C,
  'reactionrole.create': 0x3498DB,
  'reactionrole.delete': 0x8B0000,
  'reactionrole.update': 0xFFA500,

  'giveaway.create': 0x57F287,
  'giveaway.winner': 0xFEE75C,
  'giveaway.reroll': 0x3498DB,
  'giveaway.delete': 0xE74C3C,

  'leveling.levelup': 0x00FF00,
  'leveling.milestone': 0xFFD700,

  'counter.update': 0x0099FF,
  'counter.config': 0x5865F2,

  'application.submit': 0x5865F2,
  'application.review': 0x57F287,

  'report.file': 0xED4245,
};

/*
|--------------------------------------------------------------------------
| ICONS
|--------------------------------------------------------------------------
*/

const EVENT_ICONS = {
  'moderation.ban': '🔨',
  'moderation.unban': '🔓',
  'moderation.kick': '👢',
  'moderation.warn': '⚠️',
  'moderation.timeout': '⏳',
  'moderation.untimeout': '✅',
  'moderation.mute': '🔇',
  'moderation.purge': '🗑️',
  'moderation.lock': '🔒',
  'moderation.unlock': '🔓',
  'moderation.dm': '✉️',
  'moderation.config': '⚙️',

  'message.delete': '❌',
  'message.edit': '✏️',
  'message.bulkdelete': '🗑️',

  'role.create': '➕',
  'role.update': '🔄',
  'role.delete': '➖',

  'channel.create': '➕',
  'channel.update': '🔄',
  'channel.delete': '➖',

  'category.create': '➕',
  'category.update': '🔄',
  'category.delete': '➖',

  'member.join': '👋',
  'member.leave': '👋',
  'member.namechange': '🏷️',

  'webhook.create': '🔗',
  'webhook.update': '🔄',
  'webhook.delete': '🗑️',

  'integration.create': '🔗',
  'integration.update': '🔄',
  'integration.delete': '🗑️',

  'reactionrole.add': '✅',
  'reactionrole.remove': '❌',
  'reactionrole.create': '🎭',
  'reactionrole.delete': '🗑️',
  'reactionrole.update': '🔄',

  'giveaway.create': '🎁',
  'giveaway.winner': '🎉',
  'giveaway.reroll': '🔄',
  'giveaway.delete': '🗑️',

  'leveling.levelup': '📈',
  'leveling.milestone': '🏆',

  'counter.update': '📊',
  'counter.config': '⚙️',

  'application.submit': '📝',
  'application.review': '📋',

  'report.file': '🚨',
};

/*
|--------------------------------------------------------------------------
| AUDIT LOG EVENTS
|--------------------------------------------------------------------------
*/

const AUDIT_LOG_EVENT_TYPES = {
  [AuditLogEvent.WebhookCreate]: EVENT_TYPES.WEBHOOK_CREATE,
  [AuditLogEvent.WebhookUpdate]: EVENT_TYPES.WEBHOOK_UPDATE,
  [AuditLogEvent.WebhookDelete]: EVENT_TYPES.WEBHOOK_DELETE,

  [AuditLogEvent.IntegrationCreate]: EVENT_TYPES.INTEGRATION_CREATE,
  [AuditLogEvent.IntegrationUpdate]: EVENT_TYPES.INTEGRATION_UPDATE,
  [AuditLogEvent.IntegrationDelete]: EVENT_TYPES.INTEGRATION_DELETE,
};

/*
|--------------------------------------------------------------------------
| CATEGORY DESTINATIONS
|--------------------------------------------------------------------------
*/

const CATEGORY_DESTINATION = {
  application: 'applications',
  report: 'reports',
};

/*
|--------------------------------------------------------------------------
| FIXED DESTINATION CHECK
|--------------------------------------------------------------------------
*/

function isFixedDestination(destination) {
  return Object.prototype.hasOwnProperty.call(
    LOG_CHANNELS,
    destination,
  );
}

/*
|--------------------------------------------------------------------------
| RESOLVE LOG CHANNEL
|--------------------------------------------------------------------------
*/

export function resolveLogChannel(config, destination) {
  if (isFixedDestination(destination)) {
    return LOG_CHANNELS[destination];
  }

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
    config?.logIgnore ?? {
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
  if (!eventType || typeof eventType !== 'string') {
    return false;
  }

  /*
   * Fixed logging events should work even if the old logging
   * configuration did not have logging.enabled set.
   */
  const destination = EVENT_DESTINATIONS[eventType];

  if (isFixedDestination(destination)) {
    const enabledEvents = config?.logging?.enabledEvents || {};

    if (enabledEvents[eventType] === false) {
      return false;
    }

    if (enabledEvents[`${eventType.split('.')[0]}.*`] === false) {
      return false;
    }

    return true;
  }

  if (!config?.logging?.enabled) {
    return false;
  }

  const enabledEvents = config.logging.enabledEvents || {};

  if (enabledEvents[eventType] === false) {
    return false;
  }

  if (enabledEvents[`${eventType.split('.')[0]}.*`] === false) {
    return false;
  }

  return true;
}

/*
|--------------------------------------------------------------------------
| EVENT -> CHANNEL
|--------------------------------------------------------------------------
*/

function getLogChannelForEvent(
  config,
  eventType,
  overrideChannelId = null,
) {
  if (overrideChannelId) {
    return overrideChannelId;
  }

  const category = eventType?.split('.')[0];

  const destination =
    EVENT_DESTINATIONS[eventType] ||
    CATEGORY_DESTINATION[category] ||
    'audit';

  return resolveLogChannel(config, destination);
}

/*
|--------------------------------------------------------------------------
| TICKET CHECK
|--------------------------------------------------------------------------
*/

function isTicketChannel(channel) {
  if (!channel) {
    return false;
  }

  const name = channel.name?.toLowerCase() || '';
  const topic = channel.topic?.toLowerCase() || '';

  return (
    name.startsWith('ticket-') ||
    name.includes('ticket') ||
    topic.includes('ticket')
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
      await client.guilds.fetch(guildId).catch(() => null);

    if (!guild) {
      logger.warn(`logEvent: Guild not found: ${guildId}`);
      return null;
    }

    /*
     * Ignore ticket activity for server channel logs.
     * Tickets have their own logging system.
     */
    if (
      (eventType === EVENT_TYPES.CHANNEL_CREATE ||
        eventType === EVENT_TYPES.CHANNEL_UPDATE ||
        eventType === EVENT_TYPES.CHANNEL_DELETE) &&
      isTicketChannel(data.channel)
    ) {
      return null;
    }

    const config = await getGuildConfig(client, guildId);
    const ignore = getIgnoreList(config);

    if (
      data?.userId &&
      ignore.users?.includes(data.userId)
    ) {
      return null;
    }

    if (
      data?.channelId &&
      ignore.channels?.includes(data.channelId)
    ) {
      return null;
    }

    if (!isEventEnabled(config, eventType)) {
      return null;
    }

    const logChannelId = getLogChannelForEvent(
      config,
      eventType,
      overrideChannelId,
    );

    if (!logChannelId) {
      return null;
    }

    const channel =
      guild.channels.cache.get(logChannelId) ||
      await guild.channels.fetch(logChannelId).catch(() => null);

    if (!channel) {
      logger.warn(
        `logEvent: Log channel ${logChannelId} not found`,
      );
      return null;
    }

    if (
      channel.type !== ChannelType.GuildText &&
      channel.type !== ChannelType.GuildAnnouncement
    ) {
      logger.warn(
        `logEvent: Invalid log channel ${logChannelId}`,
      );
      return null;
    }

    const me = guild.members.me;

    if (me) {
      const permissions = channel.permissionsFor(me);

      if (
        !permissions ||
        !permissions.has(['SendMessages', 'EmbedLinks'])
      ) {
        logger.warn(
          `logEvent: Missing permissions in channel ${logChannelId}`,
        );
        return null;
      }
    }

    const embed = createLogEmbed(
      guild,
      eventType,
      data,
    );

    const messageOptions = {
      embeds: [embed],
    };

    if (content) {
      messageOptions.content = content;
    }

    if (attachments?.length > 0) {
      messageOptions.files = attachments;
    }

    const sent = await channel.send(messageOptions);

    logger.info(
      `Event logged: ${eventType} in guild ${guildId}`,
    );

    return sent;
  } catch (error) {
    logger.error(
      `Error in logEvent: ${error?.stack || error}`,
    );

    return null;
  }
}

/*
|--------------------------------------------------------------------------
| CREATE EMBED
|--------------------------------------------------------------------------
*/

function createLogEmbed(guild, eventType, data) {
  const color =
    data.color ??
    EVENT_COLORS[eventType] ??
    0x0099ff;

  const icon =
    EVENT_ICONS[eventType] ||
    '📌';

  const title =
    data.title ||
    `${icon} ${formatEventType(eventType)}`;

  const inlineFields = [];

  let description =
    data.description || '';

  if (data.lines?.length) {
    description = buildLogDescription({
      headline:
        data.headline ||
        description ||
        undefined,

      lines: data.lines,

      quoted:
        data.quoted !== false,

      meta: data.meta,
    });

    if (data.fields?.length) {
      const {
        before,
        after,
      } = splitComparisonFields(data.fields);

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
  } else if (data.fields?.length) {
    const {
      before,
      after,
      rest,
    } = splitComparisonFields(data.fields);

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

          lines: metaLines,

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
  } else if (data.meta?.length) {
    description =
      buildLogDescription({
        headline:
          description ||
          undefined,

        meta: data.meta,
      });
  }

  if (data.section?.body) {
    description =
      appendContentSection(
        description,
        data.section.title ||
          'Message',
        data.section.body,
      );
  }

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
| FORMAT EVENT NAME
|--------------------------------------------------------------------------
*/

function formatEventType(eventType) {
  if (
    !eventType ||
    typeof eventType !== 'string'
  ) {
    return 'Unknown Event';
  }

  return eventType
    .split('.')
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1),
    )
    .join(' ');
}

/*
|--------------------------------------------------------------------------
| GET LOGGING STATUS
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
      logging.enabled || false,

    channels: {
      ...LOG_CHANNELS,

      ...(logging.channels || {}),
    },

    channelId:
      LOG_CHANNELS.moderation,

    ignore:
      getIgnoreList(config),

    enabledEvents:
      logging.enabledEvents || {},

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
        ...(config.logging?.enabledEvents || {}),
      },
    };

    const types = Array.isArray(eventTypes)
      ? eventTypes
      : [eventTypes];

    types.forEach((type) => {
      if (type.endsWith('.*')) {
        const category =
          type.replace('.*', '');

        const matchingTypes =
          Object.values(EVENT_TYPES)
            .filter((eventType) =>
              eventType.startsWith(
                `${category}.`,
              ),
            );

        matchingTypes.forEach(
          (eventType) => {
            logging.enabledEvents[
              eventType
            ] = enabled;
          },
        );

        logging.enabledEvents[type] =
          enabled;
      } else {
        logging.enabledEvents[type] =
          enabled;
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
*/

export async function setLogChannel(
  client,
  guildId,
  destination,
  channelId,
) {
  /*
   * Fixed channels cannot be changed through
   * the old configuration system.
   */
  if (isFixedDestination(destination)) {
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
        ...(config.logging?.channels || {}),
        [destination]: channelId,
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
| OLD SET LOGGING CHANNEL
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

    ignore[listKey] = current;

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
| AUDIT LOG HELPERS
|--------------------------------------------------------------------------
*/

function formatAuditValue(value) {
  if (value === null || value === undefined) {
    return 'None';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (
    typeof value === 'object'
  ) {
    try {
      return JSON.stringify(
        value,
        null,
        2,
      );
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function getAuditChanges(entry) {
  if (!entry?.changes?.length) {
    return [];
  }

  return entry.changes
    .filter(
      (change) =>
        change.key !== 'position',
    )
    .map((change) => ({
      name:
        change.key || 'Unknown',
      value:
        formatAuditValue(
          change.new ??
            change.old,
        ),
    }));
}

/*
|--------------------------------------------------------------------------
| AUDIT LOG -> EVENT TYPE
|--------------------------------------------------------------------------
*/

export function getEventTypeFromAuditLog(
  entry,
) {
  if (!entry) {
    return null;
  }

  return (
    AUDIT_LOG_EVENT_TYPES[
      entry.action
    ] || null
  );
}

/*
|--------------------------------------------------------------------------
| AUDIT LOG ENTRY
|--------------------------------------------------------------------------
*/

export async function logAuditLogEntry(
  entry,
) {
  try {
    const eventType =
      getEventTypeFromAuditLog(
        entry,
      );

    if (!eventType) {
      return null;
    }

    const guild = entry.guild;

    if (!guild) {
      return null;
    }

    const executor =
      entry.executor;

    const target =
      entry.target;

    const changes =
      getAuditChanges(entry);

    return logEvent({
      client: guild.client,

      guildId: guild.id,

      eventType,

      data: {
        title:
          `${EVENT_ICONS[eventType] || '📌'} ` +
          `${formatEventType(eventType)}`,

        description:
          'A server audit log event was detected.',

        fields: [
          {
            name: 'Executor',
            value:
              executor
                ? `<@${executor.id}> (${executor.tag || executor.username || executor.id})`
                : 'Unknown',
          },

          {
            name: 'Target',
            value:
              target
                ? (
                    target.id
                      ? `<#${target.id}>`
                      : target.name ||
                        target.id ||
                        String(target)
                  )
                : 'Unknown',
          },

          {
            name: 'Action',
            value:
              formatEventType(
                eventType,
              ),
          },

          ...changes,
        ],

        userId:
          executor?.id || null,
      },
    });
  } catch (error) {
    logger.error(
      'Error logging audit entry:',
      error,
    );

    return null;
  }
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
  EVENT_DESTINATIONS,
  AUDIT_LOG_EVENT_TYPES,
};
