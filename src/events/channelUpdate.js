import { Events, ChannelType } from 'discord.js';
import {
    logEvent,
    EVENT_TYPES,
} from '../services/loggingService.js';

export default {
    name: Events.ChannelUpdate,
    once: false,

    async execute(oldChannel, newChannel, client) {
        try {
            if (!newChannel?.guild) return;

            const isCategory =
                newChannel.type === ChannelType.GuildCategory;

            const changes = [];

            if (oldChannel.name !== newChannel.name) {
                changes.push({
                    name: 'Name',
                    value: `${oldChannel.name || 'Unknown'} → ${newChannel.name || 'Unknown'}`,
                });
            }

            if (oldChannel.parentId !== newChannel.parentId) {
                changes.push({
                    name: 'Category',
                    value:
                        `${oldChannel.parent?.name || 'None'} → ` +
                        `${newChannel.parent?.name || 'None'}`,
                });
            }

            if (
                'topic' in oldChannel &&
                'topic' in newChannel &&
                oldChannel.topic !== newChannel.topic
            ) {
                changes.push({
                    name: 'Topic',
                    value:
                        `${oldChannel.topic || 'None'} → ` +
                        `${newChannel.topic || 'None'}`,
                });
            }

            if (
                'nsfw' in oldChannel &&
                'nsfw' in newChannel &&
                oldChannel.nsfw !== newChannel.nsfw
            ) {
                changes.push({
                    name: 'NSFW',
                    value:
                        `${oldChannel.nsfw ? 'Enabled' : 'Disabled'} → ` +
                        `${newChannel.nsfw ? 'Enabled' : 'Disabled'}`,
                });
            }

            if (
                'rateLimitPerUser' in oldChannel &&
                'rateLimitPerUser' in newChannel &&
                oldChannel.rateLimitPerUser !==
                    newChannel.rateLimitPerUser
            ) {
                changes.push({
                    name: 'Slowmode',
                    value:
                        `${oldChannel.rateLimitPerUser || 0}s → ` +
                        `${newChannel.rateLimitPerUser || 0}s`,
                });
            }

            /*
             * IMPORTANT:
             * If Discord only changed the channel position,
             * changes[] stays empty, so nothing gets logged.
             */
            if (changes.length === 0) {
                return;
            }

            console.log(
                `[CHANNEL LOG] Updated: ${newChannel.name} (${newChannel.id})`
            );

            await logEvent({
                client,
                guildId: newChannel.guild.id,

                eventType: isCategory
                    ? EVENT_TYPES.CATEGORY_UPDATE
                    : EVENT_TYPES.CHANNEL_UPDATE,

                data: {
                    channel: newChannel,
                    channelId: newChannel.id,
                    channelName: newChannel.name,

                    title: isCategory
                        ? '🔄 Category Updated'
                        : '🔄 Channel Updated',

                    description:
                        `Changes were made to ${newChannel.name}.`,

                    fields: changes,
                },
            });
        } catch (error) {
            console.error(
                '[CHANNEL LOG] Update error:',
                error
            );
        }
    },
};
