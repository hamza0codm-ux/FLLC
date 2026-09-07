import {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} from 'discord.js';

import {
    createSuggestionId,
    saveSuggestion,
} from '../../services/suggestionService.js';

const ADMIN_CHANNEL_ID = '1545354349574758450';

export default {
    name: 'suggestion_submit',
    
    async execute(interaction) {
        const suggestion = interaction.fields
            .getTextInputValue('suggestion_text')
            .trim();

        if (!suggestion) {
            return interaction.reply({
                content: 'Please enter a suggestion.',
                ephemeral: true,
            });
        }

        const adminChannel = await interaction.client.channels.fetch(
            ADMIN_CHANNEL_ID
        );

        if (!adminChannel || !adminChannel.isTextBased()) {
            return interaction.reply({
                content: 'The suggestion system is currently unavailable.',
                ephemeral: true,
            });
        }

        const id = createSuggestionId();
        const createdAt = Date.now();

        const suggestionData = {
            id,
            userId: interaction.user.id,
            guildId: interaction.guildId,
            suggestion,
            status: 'pending',
            createdAt,
            actionBy: null,
            actionAt: null,
            adminMessageId: null,
            communityMessageId: null,
            sentToCommunity: false,
        };

        const LOADING = '<a:Loading:1546268064008642641>';
        const APPLY = '<:Apply:1329723672801316925>';

        const adminEmbed = {
            color: 0xF8D568,
            title: 'New Fruity Suggestion',
            description:
                `${LOADING} **Status** ${LOADING} Pending • <t:${Math.floor(createdAt / 1000)}:F>\n` +
                `${APPLY} **Action by:** ${LOADING} Pending\n\n` +
                `**From:** <@${interaction.user.id}>\n` +
                `\`${escapeInlineCode(suggestion)}\``,
        };

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import(
            'discord.js'
        );

        const YES = {
            name: 'Yes',
            id: '1545795445043888239',
            animated: true,
        };

        const NO = {
            name: 'No',
            id: '1545795160586190858',
            animated: true,
        };

        const PACKAGE = {
            name: 'Package',
            id: '1546271416436006942',
            animated: true,
        };

        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`suggestion:approve:${id}`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(YES),

            new ButtonBuilder()
                .setCustomId(`suggestion:deny:${id}`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(NO),

            new ButtonBuilder()
                .setCustomId(`suggestion:community:${id}`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(PACKAGE)
        );

        const message = await adminChannel.send({
            embeds: [adminEmbed],
            components: [actionRow],
        });

        suggestionData.adminMessageId = message.id;

        await saveSuggestion(interaction.client, suggestionData);

        await interaction.reply({
            content:
                '<a:Loading:1546268064008642641> Your suggestion has been submitted to Fruity Management.',
            ephemeral: true,
        });
    },
};

function escapeInlineCode(text) {
    return text.replace(/`/g, '\\`');
}
