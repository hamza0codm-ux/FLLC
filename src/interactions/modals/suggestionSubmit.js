import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';

import {
    createSuggestionId,
    saveSuggestion,
} from '../../services/suggestionService.js';

const ADMIN_CHANNEL_ID = '1545354349574758450';

export default {
    name: 'suggestion_submit',

    async execute(interaction, client) {
        const suggestionText = interaction.fields
            .getTextInputValue('suggestion_text')
            .trim();

        if (!suggestionText) {
            return interaction.reply({
                content: 'Please enter a suggestion.',
                ephemeral: true,
            });
        }

        const adminChannel = await client.channels.fetch(
            ADMIN_CHANNEL_ID
        );

        if (!adminChannel?.isTextBased()) {
            return interaction.reply({
                content:
                    'The suggestion management channel could not be found.',
                ephemeral: true,
            });
        }

        const id = createSuggestionId();
        const createdAt = Date.now();

        const suggestion = {
            id,
            userId: interaction.user.id,
            guildId: interaction.guildId,
            suggestion: suggestionText,
            status: 'pending',
            createdAt,
            actionBy: null,
            actionAt: null,
            adminMessageId: null,
            communityMessageId: null,
            sentToCommunity: false,
        };

        const embed = new EmbedBuilder()
            .setColor('#F8D568')
            .setTitle('New Fruity Suggestion')
            .setDescription(
                `<a:Loading:1546268064008642641> **Status:** <a:Loading:1546268064008642641> Pending • <t:${Math.floor(createdAt / 1000)}:F>\n` +
                `<:Apply:1329723672801316925> **Action by:** <a:Loading:1546268064008642641> Pending\n\n` +
                `**From:** <@${interaction.user.id}>\n` +
                `\`${escapeInlineCode(suggestionText)}\``
            );

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`suggestion:approve:${id}`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji({
                    name: 'Yes',
                    id: '1545795445043888239',
                    animated: true,
                }),

            new ButtonBuilder()
                .setCustomId(`suggestion:deny:${id}`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji({
                    name: 'No',
                    id: '1545795160586190858',
                    animated: true,
                }),

            new ButtonBuilder()
                .setCustomId(`suggestion:community:${id}`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji({
                    name: 'Package',
                    id: '1546271416436006942',
                    animated: true,
                })
        );

        const message = await adminChannel.send({
            embeds: [embed],
            components: [buttons],
        });

        suggestion.adminMessageId = message.id;

        await saveSuggestion(client, suggestion);

        await interaction.reply({
            content:
                '<a:Loading:1546268064008642641> Your suggestion has been submitted!',
            ephemeral: true,
        });
    },
};

function escapeInlineCode(text) {
    return text.replace(/`/g, '\\`');
}
