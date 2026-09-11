import {
    EmbedBuilder,
    ModalBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';

import {
    getTicketData,
    saveTicketData,
} from '../../../utils/database.js';

import { logger } from '../../../utils/logger.js';
import { getColor } from '../../../config/bot.js';
import { logTicketFeedback } from '../../../utils/ticket/ticketLogging.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';

const STAR_LABELS = {
    '1': '⭐ 1 — Poor',
    '2': '⭐ 2 — Below Average',
    '3': '⭐ 3 — Average',
    '4': '⭐ 4 — Good',
    '5': '⭐ 5 — Excellent',
};

function getFeedback(ticketData) {
    return {
        rating: Number.isInteger(ticketData?.feedback?.rating)
            ? ticketData.feedback.rating
            : null,

        comment:
            typeof ticketData?.feedback?.comment === 'string' &&
            ticketData.feedback.comment.trim().length > 0
                ? ticketData.feedback.comment.trim()
                : null,

        submittedAt: ticketData?.feedback?.submittedAt ?? null,

        loggedAt: ticketData?.feedback?.loggedAt ?? null,

        declined: ticketData?.feedback?.declined === true,
    };
}

function buildFeedbackEmbed(ticketData) {
    const feedback = getFeedback(ticketData);

    let description = 'You can rate your support experience and leave a comment.\n\n';

    description += feedback.rating
        ? `⭐ **Rating:** ${STAR_LABELS[String(feedback.rating)]}\n`
        : '⭐ **Rating:** Not submitted yet\n';

    description += feedback.comment
        ? `✍️ **Comment:** ${feedback.comment}\n`
        : '✍️ **Comment:** Not submitted yet\n';

    if (feedback.rating && feedback.comment) {
        description += '\n✅ **Thank you!** Your rating and comment have both been recorded.';
    } else if (feedback.rating) {
        description += '\nYou can still add a comment below.';
    } else if (feedback.comment) {
        description += '\nYou can still leave a rating below.';
    }

    return new EmbedBuilder()
        .setTitle('⭐ How was your support experience?')
        .setDescription(description)
        .setColor(getColor('default'))
        .setFooter({
            text: 'Your feedback helps us improve.',
        });
}

function buildFeedbackComponents(ticketData, guildId, channelId) {
    const feedback = getFeedback(ticketData);

    const base = `ticket_feedback:${guildId}:${channelId}`;

    const starsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${base}:1`)
            .setLabel('⭐ 1')
            .setStyle(
                feedback.rating === 1
                    ? ButtonStyle.Primary
                    : ButtonStyle.Secondary,
            ),

        new ButtonBuilder()
            .setCustomId(`${base}:2`)
            .setLabel('⭐ 2')
            .setStyle(
                feedback.rating === 2
                    ? ButtonStyle.Primary
                    : ButtonStyle.Secondary,
            ),

        new ButtonBuilder()
            .setCustomId(`${base}:3`)
            .setLabel('⭐ 3')
            .setStyle(
                feedback.rating === 3
                    ? ButtonStyle.Primary
                    : ButtonStyle.Secondary,
            ),

        new ButtonBuilder()
            .setCustomId(`${base}:4`)
            .setLabel('⭐ 4')
            .setStyle(
                feedback.rating === 4
                    ? ButtonStyle.Primary
                    : ButtonStyle.Secondary,
            ),

        new ButtonBuilder()
            .setCustomId(`${base}:5`)
            .setLabel('⭐ 5')
            .setStyle(
                feedback.rating === 5
                    ? ButtonStyle.Primary
                    : ButtonStyle.Secondary,
            ),
    );

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(
                `ticket_feedback_comment:${guildId}:${channelId}`,
            )
            .setLabel(
                feedback.comment
                    ? '✍️ Edit Comment'
                    : '✍️ Add Comment',
            )
            .setStyle(
                feedback.comment
                    ? ButtonStyle.Primary
                    : ButtonStyle.Secondary,
            ),

        new ButtonBuilder()
            .setCustomId(
                `ticket_feedback_decline:${guildId}:${channelId}`,
            )
            .setLabel('❌ No thanks')
            .setStyle(ButtonStyle.Secondary),
    );

    return [starsRow, actionRow];
}

async function finishFeedbackIfComplete({
    interaction,
    guildId,
    channelId,
    ticketData,
}) {
    const feedback = getFeedback(ticketData);

    if (!feedback.rating || !feedback.comment || feedback.loggedAt) {
        return false;
    }

    const submittedAt = feedback.submittedAt ?? new Date().toISOString();

    ticketData.feedback = {
        ...ticketData.feedback,
        rating: feedback.rating,
        comment: feedback.comment,
        submittedAt,
        loggedAt: new Date().toISOString(),
        declined: false,
    };

    try {
        await saveTicketData(guildId, channelId, ticketData);
    } catch (err) {
        logger.error('ticketFeedback: failed to save completed feedback', {
            guildId,
            channelId,
            error: err.message,
        });

        return false;
    }

    try {
        await logTicketFeedback({
            client: interaction.client,
            guildId,
            ticketNumber: ticketData.id,
            ticketChannelId: channelId,
            userId: interaction.user.id,
            rating: feedback.rating,
            comment: feedback.comment,
        });
    } catch (err) {
        logger.warn('ticketFeedback: failed to send completed feedback log', {
            guildId,
            channelId,
            error: err.message,
        });
    }

    return true;
}

const feedbackHandler = {
    name: 'ticket_feedback',

    async execute(interaction, client, args) {
        const [guildId, channelId, ratingStr] = args;

        if (!guildId || !channelId || !ratingStr) {
            await InteractionHelper.safeReply(interaction, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('⚠️ Invalid Feedback Link')
                        .setDescription(
                            'This feedback link appears to be malformed.',
                        )
                        .setColor(getColor('error')),
                ],
                components: [],
            });

            return;
        }

        const rating = Number.parseInt(ratingStr, 10);

        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            await InteractionHelper.safeReply(interaction, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('⚠️ Invalid Rating')
                        .setDescription(
                            'Please select a rating from 1 to 5 stars.',
                        )
                        .setColor(getColor('error')),
                ],
                components: [],
            });

            return;
        }

        try {
            await interaction.deferUpdate();
        } catch (err) {
            logger.warn(
                'ticketFeedback: interaction expired before deferUpdate',
                {
                    guildId,
                    channelId,
                    error: err.message,
                },
            );

            return;
        }

        let ticketData;

        try {
            ticketData = await getTicketData(guildId, channelId);
        } catch (err) {
            logger.warn('ticketFeedback: failed to load ticket data', {
                guildId,
                channelId,
                error: err.message,
            });
        }

        if (!ticketData) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('⚠️ Ticket Not Found')
                        .setDescription(
                            'Could not find the ticket associated with this survey.',
                        )
                        .setColor(getColor('error')),
                ],
                components: [],
            });

            return;
        }

        if (interaction.user.id !== ticketData.userId) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('❌ Not Allowed')
                        .setDescription(
                            'Only the ticket creator can submit feedback for this ticket.',
                        )
                        .setColor(getColor('error')),
                ],
                components: [],
            });

            return;
        }

        const existingFeedback = getFeedback(ticketData);

        /*
         * Do NOT finalize here.
         *
         * A rating is independent from the comment.
         * The user must still be able to add a comment afterwards.
         */
        ticketData.feedback = {
            ...ticketData.feedback,

            rating,

            // Preserve an existing comment.
            comment: existingFeedback.comment,

            // Preserve the original submission timestamp.
            submittedAt:
                existingFeedback.submittedAt ??
                new Date().toISOString(),

            // Rating changed, so this must not be considered
            // previously logged unless the exact review is finalized again.
            loggedAt: null,

            declined: false,
        };

        try {
            await saveTicketData(guildId, channelId, ticketData);
        } catch (err) {
            logger.error('ticketFeedback: failed to save rating', {
                guildId,
                channelId,
                rating,
                error: err.message,
            });

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('⚠️ Could Not Save Rating')
                        .setDescription(
                            'Something went wrong while saving your rating. Please try again.',
                        )
                        .setColor(getColor('error')),
                ],
                components: [],
            });

            return;
        }

        const completed = await finishFeedbackIfComplete({
            interaction,
            guildId,
            channelId,
            ticketData,
        });

        if (completed) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('✅ Thanks for your feedback!')
                        .setDescription(
                            `You rated your support experience **${STAR_LABELS[String(rating)]}** and your comment has also been recorded.\n\nThank you for helping us improve!`,
                        )
                        .setColor(getColor('success'))
                        .setFooter({
                            text: 'Thank you for using our support system.',
                        })
                        .setTimestamp(),
                ],
                components: [],
            });
        } else {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [buildFeedbackEmbed(ticketData)],
                components: buildFeedbackComponents(
                    ticketData,
                    guildId,
                    channelId,
                ),
            });
        }

        logger.info('Ticket feedback rating saved', {
            guildId,
            channelId,
            userId: interaction.user.id,
            rating,
            hasComment: Boolean(
                ticketData.feedback?.comment,
            ),
        });
    },
};

const commentHandler = {
    name: 'ticket_feedback_comment',

    async execute(interaction, client, args) {
        const [guildId, channelId] = args;

        if (!guildId || !channelId) {
            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('⚠️ Invalid Feedback Link')
                        .setDescription(
                            'This feedback action appears to be malformed.',
                        )
                        .setColor(getColor('error')),
                ],
                components: [],
            });

            return;
        }

        let ticketData;

        try {
            ticketData = await getTicketData(guildId, channelId);
        } catch (err) {
            logger.warn(
                'ticketFeedbackComment: failed to load ticket data',
                {
                    guildId,
                    channelId,
                    error: err.message,
                },
            );
        }

        if (!ticketData) {
            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('⚠️ Ticket Not Found')
                        .setDescription(
                            'Could not find the ticket associated with this survey.',
                        )
                        .setColor(getColor('error')),
                ],
                ephemeral: true,
            });

            return;
        }

        if (interaction.user.id !== ticketData.userId) {
            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('❌ Not Allowed')
                        .setDescription(
                            'Only the ticket creator can submit feedback for this ticket.',
                        )
                        .setColor(getColor('error')),
                ],
                ephemeral: true,
            });

            return;
        }

        const existingComment =
            typeof ticketData.feedback?.comment === 'string'
                ? ticketData.feedback.comment
                : '';

        const modal = new ModalBuilder()
            .setCustomId(
                `ticket_feedback_comment_modal:${guildId}:${channelId}`,
            )
            .setTitle(
                existingComment
                    ? 'Edit Ticket Feedback'
                    : 'Add Ticket Feedback',
            );

        const commentInput = new TextInputBuilder()
            .setCustomId('feedback_comment')
            .setLabel('Your feedback')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder(
                'Share what went well or how we can improve...',
            )
            .setRequired(true)
            .setMaxLength(1000)
            .setValue(existingComment.slice(0, 1000));

        modal.addComponents(
            new ActionRowBuilder().addComponents(commentInput),
        );

        await interaction.showModal(modal);
    },
};

const declineHandler = {
    name: 'ticket_feedback_decline',

    async execute(interaction, client, args) {
        const [guildId, channelId] = args;

        if (!guildId || !channelId) {
            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('⚠️ Invalid Feedback Link')
                        .setDescription(
                            'This feedback action appears to be malformed.',
                        )
                        .setColor(getColor('error')),
                ],
                components: [],
            });

            return;
        }

        let ticketData;

        try {
            ticketData = await getTicketData(guildId, channelId);
        } catch (err) {
            logger.warn(
                'ticketFeedbackDecline: failed to load ticket data',
                {
                    guildId,
                    channelId,
                    error: err.message,
                },
            );
        }

        if (ticketData && interaction.user.id === ticketData.userId) {
            ticketData.feedback = {
                ...ticketData.feedback,
                declined: true,
                submittedAt:
                    ticketData.feedback?.submittedAt ??
                    new Date().toISOString(),
            };

            try {
                await saveTicketData(
                    guildId,
                    channelId,
                    ticketData,
                );
            } catch (err) {
                logger.warn(
                    'ticketFeedbackDecline: failed to save decline',
                    {
                        guildId,
                        channelId,
                        error: err.message,
                    },
                );
            }
        }

        await interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setTitle('👋 No problem!')
                    .setDescription(
                        'Thanks for considering leaving feedback. You can always reach out again if you need further support.',
                    )
                    .setColor(getColor('default')),
            ],
            components: [],
        });
    },
};

export default [
    feedbackHandler,
    commentHandler,
    declineHandler,
];
