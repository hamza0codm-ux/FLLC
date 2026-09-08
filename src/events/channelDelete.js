import { Events, ChannelType } from 'discord.js';
import {
    logEvent,
    EVENT_TYPES,
} from '../services/loggingService.js';

export default {
    name: Events.ChannelDelete,
    once: false,

    async execute(channel, client) {
        try {
            if (!channel?.guild) return;

            const isCategory =
                channel.type === ChannelType.GuildCategory;

            console.log(
                `[CHANNEL LOG] Deleted: ${channel.name} (${channel.id})`
            );

            await logEvent({
                client,
                guildId: channel.guild.id,

                eventType: isCategory
                    ? EVENT_TYPES.CATEGORY_DELETE
                    : EVENT_TYPES.CHANNEL_DELETE,

                data: {
                    channel,
                    channelId: channel.id,
                    channelName: channel.name,

                    title: isCategory
                        ? '➖ Category Deleted'
                        : '➖ Channel Deleted',

                    description:
                        isCategory
                            ? `A category was deleted.`
                            : `A channel was deleted.`,

                    fields: [
                        {
                            name: 'Name',
                            value: channel.name || 'Unknown',
                            inline: true,
                        },
                        {
                            name: 'ID',
                            value: channel.id,
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
                '[CHANNEL LOG] Delete error:',
                error
            );
        }
    },
};
