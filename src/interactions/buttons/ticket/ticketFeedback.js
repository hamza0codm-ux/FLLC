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
    const feedback = ticketData?.feedback ?? {};

    const rating = Number(feedback.rating);

    return {
        rating:
            Number.isInteger(rating) &&
            rating >= 1 &&
            rating <= 5
                ? rating
                : null,

        comment:
            typeof feedback.comment === 'string' &&
            feedback.comment.trim().length > 0
                ? feedback.comment.trim()
                : null,

        submittedAt:
            feedback.submittedAt ?? null,

        loggedAt:
            feedback.loggedAt ?? null,

        declined:
            feedback.declined === true,
    };
}

function buildFeedbackEmbed(ticketData) {
    const feedback = getFeedback(ticketData);

    let description =
        'You can rate your support experience and leave a comment.\n\n';

    description += feedback.rating
        ? `⭐ **Rating:** ${STAR_LABELS[String(feedback.rating)]}\n`
        : '⭐ **Rating:** Not submitted yet\n';

    description += feedback.comment
        ? `✍️ **Comment:** ${feedback.comment}\n`
        : '✍️ **Comment:** Not submitted yet\n';

    if (feedback.rating && feedback.comment) {
        description +=
            '\n✅ **Thank you!** Your rating and comment have both been recorded.';
    } else if (feedback.rating) {
        description +=
            '\n✍️ You can still add a comment below.';
    } else if (feedback.comment) {
        description +=
            '\n⭐ You can still leave a rating below.';
    }

    return new EmbedBuilder()
        .setTitle('⭐ How was your support experience?')
        .setDescription(description)
        .setColor(getColor('default'))
        .setFooter({
            text: 'Your feedback helps us improve.',
        });
}

function buildFeedbackComponents(
    ticketData,
    guildId,
    channelId,
) {
    const feedback = getFeedback(ticketData);

    const hasRating = Boolean(feedback.rating);
    const hasComment = Boolean(feedback.comment);

    const base = `ticket_feedback:${guildId}:${channelId}`;

    const starsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${base}:1`)
            .setLabel('⭐ 1')
            .setStyle(
                feedback.rating === 1
                    ? ButtonStyle.Primary
                    : ButtonStyle.Secondary,
            )
            .setDisabled(hasRating),

        new ButtonBuilder()
            .setCustomId(`${base}:2`)
            .setLabel('⭐ 2')
            .setStyle(
                feedback.rating === 2
                    ? ButtonStyle.Primary
                    : ButtonStyle.Secondary,
            )
            .setDisabled(hasRating),

        new ButtonBuilder()
            .setCustomId(`${base}:3`)
            .setLabel('⭐ 3')
            .setStyle(
                feedback.rating === 3
                    ? ButtonStyle.Primary
                    : ButtonStyle.Secondary,
            )
            .setDisabled(hasRating),

        new ButtonBuilder()
            .setCustomId(`${base}:4`)
            .setLabel('⭐ 4')
            .setStyle(
                feedback.rating === 4
                    ? ButtonStyle.Primary
                    : ButtonStyle.Secondary,
            )
            .setDisabled(hasRating),

        new ButtonBuilder()
            .setCustomId(`${base}:5`)
            .setLabel('⭐ 5')
            .setStyle(
                feedback.rating === 5
                    ? ButtonStyle.Primary
                    : ButtonStyle.Secondary,
            )
            .setDisabled(hasRating),
    );

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(
                `ticket_feedback_comment:${guildId}:${channelId}`,
            )
            .setLabel(
                hasComment
                    ? '✍️ Comment Submitted'
                    : '✍️ Add Comment',
            )
            .setStyle(
                hasComment
                    ? ButtonStyle.Primary
                    : ButtonStyle.Secondary,
            )
            .setDisabled(hasComment),

        new ButtonBuilder()
            .setCustomId(
                `ticket_feedback_decline:${guildId}:${channelId}`,
            )
            .setLabel('❌ No thanks')
            .setStyle(ButtonStyle.Secondary),
    );

    return [
        starsRow,
        actionRow,
    ];
}

async function finishFeedbackIfComplete({
    interaction,
    guildId,
    channelId,
    ticketData,
}) {
    const feedback = getFeedback(ticketData);

    if (!feedback.rating || !feedback.comment) {
        return false;
    }

    if (feedback.loggedAt) {
        return true;
    }

    const loggedAt = new Date().toISOString();

    ticketData.feedback = {
        ...ticketData.feedback,

        rating: feedback.rating,
        comment: feedback.comment,

        submittedAt:
            feedback.submittedAt ??
            loggedAt,

        loggedAt,

        declined: false,
    };

    try {
        await saveTicketData(
            guildId,
            channelId,
            ticketData,
        );
    } catch (err) {
        logger.error(
            'ticketFeedback: failed to save completed feedback',
            {
                guildId,
                channelId,
                error: err.message,
            },
        );

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
        logger.warn(
            'ticketFeedback: failed to send completed feedback log',
            {
                guildId,
                channelId,
                error: err.message,
            },
        );
    }

    logger.info(
        'Ticket feedback fully submitted',
        {
            guildId,
            channelId,
            userId: interaction.user.id,
            rating: feedback.rating,
            comment: feedback.comment,
        },
    );

    return true;
}

const feedbackHandler = {
    name: 'ticket_feedback',

    async execute(interaction, client, args) {
        const [
            guildId,
            channelId,
            ratingStr,
        ] = args;

        if (
            !guildId ||
            !channelId ||
            !ratingStr
        ) {
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

        const rating = Number.parseInt(
            ratingStr,
            10,
        );

        if (
            !Number.isInteger(rating) ||
            rating < 1 ||
            rating > 5
        ) {
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
            ticketData = await getTicketData(
                guildId,
                channelId,
            );
        } catch (err) {
            logger.warn(
                'ticketFeedback: failed to load ticket data',
                {
                    guildId,
                    channelId,
                    error: err.message,
                },
            );
        }

        if (!ticketData) {
            await InteractionHelper.safeEditReply(
                interaction,
                {
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('⚠️ Ticket Not Found')
                            .setDescription(
                                'Could not find the ticket associated with this survey.',
                            )
                            .setColor(getColor('error')),
                    ],
                    components: [],
                },
            );

            return;
        }

        if (
            interaction.user.id !==
            ticketData.userId
        ) {
            await InteractionHelper.safeEditReply(
                interaction,
                {
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('❌ Not Allowed')
                            .setDescription(
                                'Only the ticket creator can submit feedback for this ticket.',
                            )
                            .setColor(getColor('error')),
                    ],
                    components: [],
                },
            );

            return;
        }

        const existingFeedback =
            getFeedback(ticketData);

        /*
         * HARD PROTECTION:
         *
         * A rating can only ever be submitted once.
         */
        if (existingFeedback.rating) {
            await InteractionHelper.safeEditReply(
                interaction,
                {
                    embeds: [
                        buildFeedbackEmbed(
                            ticketData,
                        ),
                    ],
                    components:
                        buildFeedbackComponents(
                            ticketData,
                            guildId,
                            channelId,
                        ),
                },
            );

            return;
        }

        /*
         * Save the rating.
         *
         * Preserve an existing comment if the user
         * submitted the comment first.
         */
        ticketData.feedback = {
            ...ticketData.feedback,

            rating,

            comment:
                existingFeedback.comment,

            submittedAt:
                existingFeedback.submittedAt ??
                new Date().toISOString(),

            loggedAt:
                existingFeedback.loggedAt ??
                null,

            declined: false,
        };

        try {
            await saveTicketData(
                guildId,
                channelId,
                ticketData,
            );
        } catch (err) {
            logger.error(
                'ticketFeedback: failed to save rating',
                {
                    guildId,
                    channelId,
                    rating,
                    error: err.message,
                },
            );

            await InteractionHelper.safeEditReply(
                interaction,
                {
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(
                                '⚠️ Could Not Save Rating',
                            )
                            .setDescription(
                                'Something went wrong while saving your rating. Please try again.',
                            )
                            .setColor(
                                getColor('error'),
                            ),
                    ],
                    components: [],
                },
            );

            return;
        }

        const completed =
            await finishFeedbackIfComplete({
                interaction,
                guildId,
                channelId,
                ticketData,
            });

        if (completed) {
            const feedback =
                getFeedback(ticketData);

            await InteractionHelper.safeEditReply(
                interaction,
                {
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(
                                '✅ Thanks for your feedback!',
                            )
                            .setDescription(
                                `Your feedback has been recorded successfully!\n\n**Rating:** ${STAR_LABELS[String(feedback.rating)]}\n**Comment:** ${feedback.comment}\n\nThank you for helping us improve!`,
                            )
                            .setColor(
                                getColor('success'),
                            )
                            .setFooter({
                                text: 'Thank you for using our support system.',
                            })
                            .setTimestamp(),
                    ],
                    components: [],
                },
            );

            return;
        }

        await InteractionHelper.safeEditReply(
            interaction,
            {
                embeds: [
                    buildFeedbackEmbed(
                        ticketData,
                    ),
                ],
                components:
                    buildFeedbackComponents(
                        ticketData,
                        guildId,
                        channelId,
                    ),
            },
        );

        logger.info(
            'Ticket feedback rating saved; waiting for comment',
            {
                guildId,
                channelId,
                userId: interaction.user.id,
                rating,
            },
        );
    },
};

const commentHandler = {
    name: 'ticket_feedback_comment',

    async execute(
        interaction,
        client,
        args,
    ) {
        const [
            guildId,
            channelId,
        ] = args;

        if (
            !guildId ||
            !channelId
        ) {
            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(
                            '⚠️ Invalid Feedback Link',
                        )
                        .setDescription(
                            'This feedback action appears to be malformed.',
                        )
                        .setColor(
                            getColor('error'),
                        ),
                ],
                components: [],
            });

            return;
        }

        let ticketData;

        try {
            ticketData =
                await getTicketData(
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
            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(
                            '⚠️ Ticket Not Found',
                        )
                        .setDescription(
                            'Could not find the ticket associated with this survey.',
                        )
                        .setColor(
                            getColor('error'),
                        ),
                ],
                ephemeral: true,
            });

            return;
        }

        if (
            interaction.user.id !==
            ticketData.userId
        ) {
            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(
                            '❌ Not Allowed',
                        )
                        .setDescription(
                            'Only the ticket creator can submit feedback for this ticket.',
                        )
                        .setColor(
                            getColor('error'),
                        ),
                ],
                ephemeral: true,
            });

            return;
        }

        const feedback =
            getFeedback(ticketData);

        /*
         * HARD PROTECTION:
         *
         * If a comment already exists, it cannot be
         * edited or submitted again.
         */
        if (feedback.comment) {
            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(
                            '✍️ Comment Already Submitted',
                        )
                        .setDescription(
                            'You have already submitted your comment for this ticket. Comments cannot be changed.',
                        )
                        .setColor(
                            getColor('warning'),
                        ),
                ],
                ephemeral: true,
            });

            return;
        }

        const modal =
            new ModalBuilder()
                .setCustomId(
                    `ticket_feedback_comment_modal:${guildId}:${channelId}`,
                )
                .setTitle(
                    'Add Ticket Feedback',
                );

        const commentInput =
            new TextInputBuilder()
                .setCustomId(
                    'feedback_comment',
                )
                .setLabel(
                    'Your feedback',
                )
                .setStyle(
                    TextInputStyle.Paragraph,
                )
                .setPlaceholder(
                    'Share what went well or how we can improve...',
                )
                .setRequired(true)
                .setMaxLength(1000);

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                commentInput,
            ),
        );

        await interaction.showModal(
            modal,
        );
    },
};

const declineHandler = {
    name: 'ticket_feedback_decline',

    async execute(
        interaction,
        client,
        args,
    ) {
        const [
            guildId,
            channelId,
        ] = args;

        if (
            !guildId ||
            !channelId
        ) {
            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(
                            '⚠️ Invalid Feedback Link',
                        )
                        .setDescription(
                            'This feedback action appears to be malformed.',
                        )
                        .setColor(
                            getColor('error'),
                        ),
                ],
                components: [],
            });

            return;
        }

        let ticketData = null;

        try {
            ticketData =
                await getTicketData(
                    guildId,
                    channelId,
                );
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

        if (
            ticketData &&
            interaction.user.id ===
                ticketData.userId
        ) {
            ticketData.feedback = {
                ...ticketData.feedback,

                declined: true,

                submittedAt:
                    ticketData.feedback
                        ?.submittedAt ??
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
                    .setTitle(
                        '👋 No problem!',
                    )
                    .setDescription(
                        'Thanks for considering leaving feedback. You can always reach out again if you need further support.',
                    )
                    .setColor(
                        getColor('default'),
                    ),
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

