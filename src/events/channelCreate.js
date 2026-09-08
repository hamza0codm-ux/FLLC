import { Events, ChannelType } from 'discord.js';
import {
    logEvent,
    EVENT_TYPES,
} from '../services/loggingService.js';

export default {
    name: Events.ChannelCreate,
    once: false,

    async execute(channel) {
        try {
            if (!channel?.guild) return;

            // Categories are handled too.
            const isCategory = channel.type === ChannelType.GuildCategory;

            await logEvent({
                eventType: isCategory
                    ? EVENT_TYPES.CATEGORY_CREATE
                    : EVENT_TYPES.CHANNEL_CREATE,

                guild: channel.guild,

                user: null,

                channel,

                data: {
                    channel,
                    category: isCategory,
                    channelId: channel.id,
                    channelName: channel.name,
                    channelType: channel.type,
                },
            });
        } catch (error) {
            console.error('[CHANNEL LOG] Create error:', error);
        }
    },
};
