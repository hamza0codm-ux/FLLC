// src/events/guildAuditLogEntryCreate.js

import { Events } from 'discord.js';

import {
    logAuditLogEntry,
} from '../services/loggingService.js';

const event = {
    name: Events.GuildAuditLogEntryCreate,
    once: false,

    async execute(entry, guild) {
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
    },
};

export const name = event.name;
export const once = event.once;
export const execute = event.execute;

export default event;
