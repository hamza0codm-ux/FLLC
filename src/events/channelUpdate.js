import { Events, ChannelType } from 'discord.js';
import {
    logEvent,
    EVENT_TYPES,
} from '../services/loggingService.js';

export default {
    name: Events.ChannelUpdate,
    once: false,

    async execute(oldChannel, newChannel) {
        try {
            if (!newChannel?.guild) return;

            /*
             * Ignore channel position changes.
             * Discord can fire ChannelUpdate when only the position changes.
             */
            const relevantChanges = [];

            if (oldChannel.name !== newChannel.name) {
                relevantChanges.push(
                    `Name: \`${oldChannel.name}\` → \`${newChannel.name}\``
                );
            }

            if (oldChannel.parentId !== newChannel.parentId) {
                relevantChanges.push(
                    `Category: \`${oldChannel.parent?.name ?? 'None'}\` → \`${newChannel.parent?.name ?? 'None'}\``
                );
            }

            if (oldChannel.topic !== newChannel.topic) {
                relevantChanges.push('Topic changed');
            }

            if (
                'nsfw' in oldChannel &&
                'nsfw' in newChannel &&
                oldChannel.nsfw !== newChannel.nsfw
            ) {
                relevantChanges.push(
                    `NSFW: \`${oldChannel.nsfw}\` → \`${newChannel.nsfw}\``
                );
            }

            if (
                oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser
            ) {
                relevantChanges.push(
                    `Slowmode: \`${oldChannel.rateLimitPerUser ?? 0}s\` → \`${newChannel.rateLimitPerUser ?? 0}s\``
                );
            }

            // If ONLY the position changed, do absolutely nothing.
            if (relevantChanges.length === 0) return;

            const isCategory = newChannel.type === ChannelType.GuildCategory;

            await logEvent({
                eventType: isCategory
                    ? EVENT_TYPES.CATEGORY_UPDATE
                    : EVENT_TYPES.CHANNEL_UPDATE,

                guild: newChannel.guild,

                user: null,

                channel: newChannel,

                data: {
                    channel: newChannel,
                    oldChannel,
                    newChannel,
                    changes: relevantChanges,
                    channelId: newChannel.id,
                    channelName: newChannel.name,
                },
            });
        } catch (error) {
            console.error('[CHANNEL LOG] Update error:', error);
        }
    },
};
