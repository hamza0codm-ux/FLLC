// src/events/guildAuditLogEntryCreate.js

import {
  Events,
} from 'discord.js';

import {
  logAuditLogEntry,
} from '../services/loggingService.js';

export const name =
  Events.GuildAuditLogEntryCreate;

export const once = false;

export async function execute(
  entry,
  guild,
) {
  try {
    if (!guild) {
      return;
    }

    await logAuditLogEntry(entry);
  } catch (error) {
    console.error(
      '[Audit Logs] Failed to process audit log entry:',
      error,
    );
  }
}
