
// src/events/guildAuditLogEntryCreate.js

import { Events } from 'discord.js';
import {
    logAuditLogEntry,
} from '../services/loggingService.js';

export const name = Events.GuildAuditLogEntryCreate;

export const once = false;

export async function execute(entry, guild) {
    try {
        if (!entry || !guild) {
            return;
        }

        console.log(
            `[LOGGING] Audit event received: ${entry.action}`,
        );

        await logAuditLogEntry(entry);
    } catch (error) {
        console.error(
            '[LOGGING] Audit log error:',
            error,
        );
    }
}

