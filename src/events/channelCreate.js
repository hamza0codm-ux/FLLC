import { Events, ChannelType } from 'discord.js';
import {
    logEvent,
    EVENT_TYPES,
} from '../services/loggingService.js';

export default {
    name: Events.ChannelCreate,
    once: false,

    async execute(channel, client) {
        try {
            if (!channel?.guild) return;

            const isCategory =
                channel.type === ChannelType.GuildCategory;

            console.log(
                `[CHANNEL LOG] Created: ${channel.name} (${channel.id})`
            );

            await logEvent({
                client,
                guildId: channel.guild.id,

                eventType: isCategory
                    ? EVENT_TYPES.CATEGORY_CREATE
                    : EVENT_TYPES.CHANNEL_CREATE,

                data: {
                    channel,
                    channelId: channel.id,
                    channelName: channel.name,

                    title: isCategory
                        ? '📁 Category Created'
                        : '➕ Channel Created',

                    description: isCategory
                        ? `A new category was created.`
                        : `A new channel was created.`,

                    fields: [
                        {
                            name: 'Channel',
                            value: `<#${channel.id}>`,
                            inline: true,
                        },
                        {
                            name: 'Name',
                            value: channel.name || 'Unknown',
                            inline: true,
                        },
                        {
                            name: 'Type',
                            value: isCategory
                                ? 'Category'
                                : String(channel.type),
                            inline: true,
                        },
                    ],
                },
            });
        } catch (error) {
            console.error(
                '[CHANNEL LOG] Create error:',
                error
            );
        }
    },
};
