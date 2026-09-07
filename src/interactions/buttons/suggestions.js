import {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
} from 'discord.js';

import {
    getSuggestion,
    updateSuggestion,
    getUserSuggestions,
} from '../../services/suggestionService.js';

const PUBLIC_CHANNEL_ID = '1545071209429999736';

const MANAGEMENT_ROLE_ID = null;
// Put your Management role ID above if you want to restrict actions to that role.
// Example:
// const MANAGEMENT_ROLE_ID = '1234567890123456789';

const YES = '<a:Yes:1545795445043888239>';
const NO = '<a:No:1545795160586190858>';
const LOADING = '<a:Loading:1546268064008642641>';
const PACKAGE = '<a:Package:1546271416436006942>';
const APPLY = '<:Apply:1329723672801316925>';

export default [
    {
        name: 'suggestion:submit',

        async execute(interaction) {
            const modal = new ModalBuilder()
                .setCustomId('suggestion_submit')
                .setTitle('Submit a Suggestion');

            const input = new TextInputBuilder()
                .setCustomId('suggestion_text')
                .setLabel('Your suggestion')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder(
                    'Tell us your idea, improvement, or suggestion...'
                )
                .setRequired(true)
                .setMaxLength(4000);

            modal.addComponents(
                new ActionRowBuilder().addComponents(input)
            );

            await interaction.showModal(modal);
        },
    },

    {
        name: 'suggestion:status',

        async execute(interaction) {
            const suggestions = await getUserSuggestions(
                interaction.client,
                interaction.user.id
            );

            if (!suggestions.length) {
                return interaction.reply({
                    content:
                        `${LOADING} You have not submitted any suggestions yet.`,
                    ephemeral: true,
                });
            }

            const lines = suggestions.slice(0, 10).map((suggestion, index) => {
                let status;

                if (suggestion.status === 'approved') {
                    status = `${YES} **Approved**`;
                } else if (suggestion.status === 'denied') {
                    status = `${NO} **Denied**`;
                } else {
                    status = `${LOADING} **Pending**`;
                }

                return (
                    `**${index + 1}.** ${status}\n` +
                    `> ${truncate(suggestion.suggestion, 150)}\n` +
                    `> Submitted <t:${Math.floor(suggestion.createdAt / 1000)}:R>`
                );
            });

            const embed = new EmbedBuilder()
                .setColor('#F8D568')
                .setTitle('Your Fruity Suggestions')
                .setDescription(lines.join('\n\n'));

            return interaction.reply({
                embeds: [embed],
                ephemeral: true,
            });
        },
    },

    {
        name: 'suggestion:approve',

        async execute(interaction) {
            await handleManagementAction(
                interaction,
                'approve'
            );
        },
    },

    {
        name: 'suggestion:deny',

        async execute(interaction) {
            await handleManagementAction(
                interaction,
                'deny'
            );
        },
    },

    {
        name: 'suggestion:community',

        async execute(interaction) {
            await handleCommunityAction(interaction);
        },
    },
];

async function handleManagementAction(interaction, action) {
    if (!hasManagementPermission(interaction)) {
        return interaction.reply({
            content:
                'You do not have permission to manage Fruity suggestions.',
            ephemeral: true,
        });
    }

    const parts = interaction.customId.split(':');
    const suggestionId = parts[2];

    const suggestion = await getSuggestion(
        interaction.client,
        suggestionId
    );

    if (!suggestion) {
        return interaction.reply({
            content: 'This suggestion could not be found.',
            ephemeral: true,
        });
    }

    if (suggestion.status !== 'pending') {
        return interaction.reply({
            content:
                `${LOADING} This suggestion has already been ${suggestion.status}.`,
            ephemeral: true,
        });
    }

    const now = Date.now();

    const status = action === 'approve'
        ? 'approved'
        : 'denied';

    const updated = await updateSuggestion(
        interaction.client,
        suggestionId,
        {
            status,
            actionBy: interaction.user.id,
            actionAt: now,
        }
    );

    const statusEmoji = status === 'approved'
        ? YES
        : NO;

    const statusText = status === 'approved'
        ? 'Approved'
        : 'Denied';

    const embed = new EmbedBuilder()
        .setColor('#F8D568')
        .setTitle('New Fruity Suggestion')
        .setDescription(
            `${LOADING} **Status** ${statusEmoji} ${statusText} • <t:${Math.floor(now / 1000)}:F>\n` +
            `${APPLY} **Action by:** <@${interaction.user.id}> • <t:${Math.floor(now / 1000)}:F>\n\n` +
            `**From:** <@${updated.userId}>\n` +
            `\`${escapeInlineCode(updated.suggestion)}\``
        );

    await interaction.update({
        embeds: [embed],
        components: [],
    });
}

async function handleCommunityAction(interaction) {
    if (!hasManagementPermission(interaction)) {
        return interaction.reply({
            content:
                'You do not have permission to manage Fruity suggestions.',
            ephemeral: true,
        });
    }

    const parts = interaction.customId.split(':');
    const suggestionId = parts[2];

    const suggestion = await getSuggestion(
        interaction.client,
        suggestionId
    );

    if (!suggestion) {
        return interaction.reply({
            content: 'This suggestion could not be found.',
            ephemeral: true,
        });
    }

    if (suggestion.status !== 'pending') {
        return interaction.reply({
            content:
                `${LOADING} This suggestion has already been ${suggestion.status}.`,
            ephemeral: true,
        });
    }

    if (suggestion.sentToCommunity) {
        return interaction.reply({
            content:
                `${PACKAGE} This suggestion has already been sent to the community.`,
            ephemeral: true,
        });
    }

    const publicChannel = await interaction.client.channels.fetch(
        PUBLIC_CHANNEL_ID
    );

    if (!publicChannel || !publicChannel.isTextBased()) {
        return interaction.reply({
            content:
                'The public suggestion channel could not be found.',
            ephemeral: true,
        });
    }

    const communityEmbed = new EmbedBuilder()
        .setColor('#F8D568')
        .setTitle('Fruity Suggestion')
        .setDescription(
            `> ${escapeInlineCode(suggestion.suggestion)}`
        )
        .setFooter({
            text: 'Vote on this suggestion below.',
        });

    const message = await publicChannel.send({
        embeds: [communityEmbed],
    });

    await message.react('<:Yes:1545795445043888239>');
    await message.react('<:No:1545795160586190858>');

    await updateSuggestion(
        interaction.client,
        suggestionId,
        {
            sentToCommunity: true,
            communityMessageId: message.id,
        }
    );

    await interaction.reply({
        content:
            `${PACKAGE} Suggestion sent to <#${PUBLIC_CHANNEL_ID}>.`,
        ephemeral: true,
    });
}

function hasManagementPermission(interaction) {
    if (interaction.memberPermissions?.has('Administrator')) {
        return true;
    }

    if (interaction.memberPermissions?.has('ManageGuild')) {
        return true;
    }

    if (MANAGEMENT_ROLE_ID && interaction.member?.roles?.cache?.has(MANAGEMENT_ROLE_ID)) {
        return true;
    }

    return false;
}

function truncate(text, length) {
    if (text.length <= length) {
        return text;
    }

    return `${text.slice(0, length - 3)}...`;
}

function escapeInlineCode(text) {
    return text.replace(/`/g, '\\`');
}
