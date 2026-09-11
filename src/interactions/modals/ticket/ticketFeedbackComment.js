import { EmbedBuilder, MessageFlags } from 'discord.js';

import {
    getTicketData,
    saveTicketData,
} from '../../../utils/database.js';

import { logger } from '../../../utils/logger.js';
import { getColor } from '../../../config/bot.js';
import { logTicketFeedback } from '../../../utils/ticket/ticketLogging.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';

const STAR_LABELS = {
    1: '⭐ 1 — Poor',
    2: '⭐ 2 — Below Average',
    3: '⭐ 3 — Average',
    4: '⭐ 4 — Good',
    5: '⭐ 5 — Excellent',
};

function buildEmbed(title, description, color) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color);
}

export default {
    name: 'ticket_feedback_comment_modal',

    async execute(interaction, client, args) {
        const [guildId, channelId] = args;

        if (!guildId || !channelId) {
            await InteractionHelper.safeReply(interaction, {
                embeds: [
                    buildEmbed(
                        '⚠️ Invalid Feedback Submission',
                        'This feedback form appears to be malformed.',
                        getColor('error'),
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        const comment = interaction.fields
            .getTextInputValue('feedback_comment')
            ?.trim();

        if (!comment) {
            await InteractionHelper.safeReply(interaction, {
                embeds: [
                    buildEmbed(
                        '⚠️ Empty Feedback',
                        'Please enter a comment before submitting your feedback.',
                        getColor('warning'),
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        const deferred = await InteractionHelper.safeDefer(
            interaction,
            {
                flags: MessageFlags.Ephemeral,
            },
        );

        if (!deferred) {
            return;
        }

        let ticketData;

        try {
            ticketData = await getTicketData(
                guildId,
                channelId,
            );
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
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    buildEmbed(
                        '⚠️ Ticket Not Found',
                        'Could not find the ticket associated with this feedback.',
                        getColor('error'),
                    ),
                ],
            });

            return;
        }

        /*
         * Only the original ticket creator can submit feedback.
         */
        if (interaction.user.id !== ticketData.userId) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    buildEmbed(
                        '❌ Not Allowed',
                        'Only the ticket creator can submit feedback for this ticket.',
                        getColor('error'),
                    ),
                ],
            });

            return;
        }

        const existingFeedback = ticketData.feedback ?? {};

        /*
         * IMPORTANT:
         *
         * Only update the comment.
         * Do NOT overwrite the rating.
         */
        ticketData.feedback = {
            ...existingFeedback,

            comment,

            commentSubmittedAt:
                new Date().toISOString(),

            /*
             * If the user previously clicked "No thanks",
             * submitting a comment means they are now giving
             * feedback, so remove the declined state.
             */
            declined: false,

            /*
             * Do not mark it as logged yet.
             * We only log once both rating + comment exist.
             */
            loggedAt: null,
        };

        try {
            await saveTicketData(
                guildId,
                channelId,
                ticketData,
            );
        } catch (err) {
            logger.error(
                'ticketFeedbackComment: failed to save feedback',
                {
                    guildId,
                    channelId,
                    error: err.message,
                },
            );

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    buildEmbed(
                        '⚠️ Could Not Save Feedback',
                        'Something went wrong while saving your comment. Please try again.',
                        getColor('error'),
                    ),
                ],
            });

            return;
        }

        const rating = Number.isInteger(
            Number(ticketData.feedback?.rating),
        )
            ? Number(ticketData.feedback.rating)
            : null;

        /*
         * COMMENT ONLY
         *
         * If there is no rating yet, do NOT log the review.
         * The user must still be able to rate afterwards.
         */
        if (!rating) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    buildEmbed(
                        '✅ Comment Saved',
                        'Your comment has been saved!\n\nYou can still rate your support experience using the rating buttons in the feedback message.',
                        getColor('success'),
                    ),
                ],
            });

            logger.info(
                'Ticket feedback comment saved; waiting for rating',
                {
                    guildId,
                    channelId,
                    userId: interaction.user.id,
                },
            );

            return;
        }

        /*
         * BOTH RATING + COMMENT NOW EXIST.
         *
         * If it was already logged, don't create another
         * review entry.
         */
        if (ticketData.feedback?.loggedAt) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    buildEmbed(
                        '✅ Feedback Updated',
                        `Your written feedback has been updated.\n\nRating: **${STAR_LABELS[rating]}**`,
                        getColor('success'),
                    ),
                ],
            });

            logger.info(
                'Ticket feedback comment updated after review was logged',
                {
                    guildId,
                    channelId,
                    userId: interaction.user.id,
                },
            );

            return;
        }

        /*
         * Both fields are present and this is the first time
         * the complete review is being submitted.
         */
        ticketData.feedback.loggedAt =
            new Date().toISOString();

        try {
            await saveTicketData(
                guildId,
                channelId,
                ticketData,
            );
        } catch (err) {
            logger.error(
                'ticketFeedbackComment: failed to save completed feedback state',
                {
                    guildId,
                    channelId,
                    error: err.message,
                },
            );
        }

        try {
            await logTicketFeedback({
                client: interaction.client,
                guildId,
                ticketNumber: ticketData.id,
                ticketChannelId: channelId,
                userId: interaction.user.id,
                rating,
                comment,
            });
        } catch (err) {
            logger.warn(
                'ticketFeedbackComment: failed to send completed feedback log',
                {
                    guildId,
                    channelId,
                    error: err.message,
                },
            );
        }

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [
                buildEmbed(
                    '✅ Feedback Submitted',
                    `Your feedback has been recorded successfully!\n\n**Rating:** ${STAR_LABELS[rating]}\n**Comment:** ${comment}\n\nThank you for helping us improve!`,
                    getColor('success'),
                ),
            ],
        });

        logger.info(
            'Ticket feedback fully submitted',
            {
                guildId,
                channelId,
                userId: interaction.user.id,
                rating,
                comment,
            },
        );
    },
};
