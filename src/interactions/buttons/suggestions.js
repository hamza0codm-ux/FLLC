import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';

import {
    getSuggestion,
    updateSuggestion,
    getUserSuggestions,
} from '../../services/suggestionService.js';

const PUBLIC_CHANNEL_ID = '1545071209429999736';

const YES = '<a:Yes:1545795445043888239>';
const NO = '<a:No:1545795160586190858>';
const LOADING = '<a:Loading:1546268064008642641>';
const PACKAGE = '<a:Package:1546271416436006942>';
const APPLY = '<:Apply:1546570253968871430>';

const MANAGEMENT_ROLE_ID = null;
// Put your Management role ID here later.
// Administrator and Manage Server also work.

export default {
    name: 'suggestion',

    async execute(interaction, client, args) {
        const action = args[0];
        const suggestionId = args[1];

        // =========================
        // SUBMIT
        // =========================

        if (action === 'submit') {
            const modal = new ModalBuilder()
                .setCustomId('suggestion_submit')
                .setTitle('Submit a Suggestion');

            const input = new TextInputBuilder()
                .setCustomId('suggestion_text')
                .setLabel('Your suggestion')
                .setPlaceholder(
                    'Tell us your idea, improvement, or suggestion...'
                )
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(4000);

            modal.addComponents(
                new ActionRowBuilder().addComponents(input)
            );

            return interaction.showModal(modal);
        }

        // =========================
        // MY STATUS
        // =========================

        if (action === 'status') {
            const suggestions = await getUserSuggestions(
                client,
                interaction.user.id
            );

            if (!suggestions.length) {
                return interaction.reply({
                    content: `${LOADING} You haven't submitted any suggestions yet.`,
                    ephemeral: true,
                });
            }

            const description = suggestions
                .slice(0, 10)
                .map((suggestion, index) => {
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
                        `> ${truncate(suggestion.suggestion, 200)}\n` +
                        `> Submitted <t:${Math.floor(suggestion.createdAt / 1000)}:R>`
                    );
                })
                .join('\n\n');

            const embed = new EmbedBuilder()
                .setColor('#F8D568')
                .setTitle('Your Fruity Suggestions')
                .setDescription(description);

            return interaction.reply({
                embeds: [embed],
                ephemeral: true,
            });
        }

        // =========================
        // MANAGEMENT CHECK
        // =========================

        if (
            action === 'approve' ||
            action === 'deny' ||
            action === 'community'
        ) {
            if (!hasManagementPermission(interaction)) {
                return interaction.reply({
                    content:
                        'You do not have permission to manage suggestions.',
                    ephemeral: true,
                });
            }
        }

        // =========================
        // APPROVE / DENY
        // =========================

        if (action === 'approve' || action === 'deny') {
            const suggestion = await getSuggestion(
                client,
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

            const status =
                action === 'approve'
                    ? 'approved'
                    : 'denied';

            const statusEmoji =
                action === 'approve'
                    ? YES
                    : NO;

            const statusText =
                action === 'approve'
                    ? 'Approved'
                    : 'Denied';

            const updated = await updateSuggestion(
                client,
                suggestionId,
                {
                    status,
                    actionBy: interaction.user.id,
                    actionAt: now,
                }
            );

            const embed = new EmbedBuilder()
                .setColor('#F8D568')
                .setTitle('New Fruity Suggestion')
                .setDescription(
                    `${LOADING} **Status** ${statusEmoji} ${statusText} • <t:${Math.floor(now / 1000)}:F>\n` +
                    `${APPLY} **Action by:** <@${interaction.user.id}> • <t:${Math.floor(now / 1000)}:F>\n\n` +
                    `**From:** <@${updated.userId}>\n` +
                    `\`${escapeInlineCode(updated.suggestion)}\``
                );

            // Remove buttons after action.
            return interaction.update({
                embeds: [embed],
                components: [],
            });
        }

        // =========================
        // SEND TO COMMUNITY
        // =========================

        if (action === 'community') {
            const suggestion = await getSuggestion(
                client,
                suggestionId
            );

            if (!suggestion) {
                return interaction.reply({
                    content: 'This suggestion could not be found.',
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

            const publicChannel = await client.channels.fetch(
                PUBLIC_CHANNEL_ID
            );

            if (!publicChannel?.isTextBased()) {
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
                );

            const message = await publicChannel.send({
                embeds: [communityEmbed],
            });

            // Add voting reactions.
            await message.react(
                'a:Yes:1545795445043888239'
            ).catch(async () => {
                await message.react(
                    '<a:Yes:1545795445043888239>'
                ).catch(() => {});
            });

            await message.react(
                'a:No:1545795160586190858'
            ).catch(async () => {
                await message.react(
                    '<a:No:1545795160586190858>'
                ).catch(() => {});
            });

            await updateSuggestion(
                client,
                suggestionId,
                {
                    sentToCommunity: true,
                    communityMessageId: message.id,
                }
            );

            return interaction.reply({
                content:
                    `${PACKAGE} Suggestion sent to <#${PUBLIC_CHANNEL_ID}>.`,
                ephemeral: true,
            });
        }

        return interaction.reply({
            content: 'Unknown suggestion action.',
            ephemeral: true,
        });
    },
};

function hasManagementPermission(interaction) {
    if (
        interaction.memberPermissions?.has('Administrator')
    ) {
        return true;
    }

    if (
        interaction.memberPermissions?.has('ManageGuild')
    ) {
        return true;
    }

    if (
        MANAGEMENT_ROLE_ID &&
        interaction.member?.roles?.cache?.has(
            MANAGEMENT_ROLE_ID
        )
    ) {
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
