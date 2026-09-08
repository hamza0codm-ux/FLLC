import { Events, ChannelType } from 'discord.js';
import {
    logEvent,
    EVENT_TYPES,
} from '../services/loggingService.js';

export default {
    name: Events.ChannelDelete,
    once: false,

    async execute(channel) {
        try {
            if (!channel?.guild) return;

            const isCategory = channel.type === ChannelType.GuildCategory;

            await logEvent({
                eventType: isCategory
                    ? EVENT_TYPES.CATEGORY_DELETE
                    : EVENT_TYPES.CHANNEL_DELETE,

                guild: channel.guild,

                user: null,

                channel,

                data: {
                    channel,
                    channelId: channel.id,
                    channelName: channel.name,
                    channelType: channel.type,
                },
            });
        } catch (error) {
            console.error('[CHANNEL LOG] Delete error:', error);
        }
    },
};
