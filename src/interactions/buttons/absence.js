import {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    PermissionFlagsBits,
} from 'discord.js';

import {
    ABSENCE_ADMIN_CHANNEL_ID,
    findAbsenceRequest,
    updateAbsenceRequest,
    updateAdminAbsenceMessage,
} from '../../services/absenceService.js';

function canReviewAbsence(interaction, adminChannel) {
    if (!interaction.guild || !interaction.member) {
        return false;
    }

    if (interaction.member.permissions?.has(PermissionFlagsBits.Administrator)) {
        return true;
    }

    const permissions = adminChannel.permissionsFor(
        interaction.member,
    );

    return Boolean(
        permissions?.has(PermissionFlagsBits.ViewChannel),
    );
}

async function handleDecision(
    interaction,
    client,
    requestId,
    status,
) {
    const adminChannel = await client.channels
        .fetch(ABSENCE_ADMIN_CHANNEL_ID)
        .catch(() => null);

    if (!adminChannel || !adminChannel.isTextBased()) {
        return interaction.reply({
            content:
                'The absence admin channel could not be found.',
            ephemeral: true,
        });
    }

    if (!canReviewAbsence(interaction, adminChannel)) {
        return interaction.reply({
            content:
                'You do not have access to review absence requests.',
            ephemeral: true,
        });
    }

    const request = await findAbsenceRequest(
        client,
        interaction.guildId,
        requestId,
    );

    if (!request) {
        return interaction.reply({
            content:
                'This absence request could not be found.',
            ephemeral: true,
        });
    }

    if (request.status !== 'pending') {
        return interaction.reply({
            content:
                `This request has already been **${request.status}**.`,
            ephemeral: true,
        });
    }

    const updated = await updateAbsenceRequest(
        client,
        interaction.guildId,
        requestId,
        {
            status,
            reviewedAt: new Date().toISOString(),
            reviewedBy: interaction.user.id,
        },
    );

    if (!updated) {
        return interaction.reply({
            content:
                'Could not update the absence request.',
            ephemeral: true,
        });
    }

    await updateAdminAbsenceMessage(
        client,
        updated,
    );

    const user = await client.users
        .fetch(updated.userId)
        .catch(() => null);

    if (user) {
        const statusText =
            status === 'approved'
                ? 'Approved'
                : 'Denied';

        const emoji =
            status === 'approved'
                ? '<a:Yes:1545795445043888239>'
                : '<a:No:1545795160586190858>';

        const dmEmbed = {
            color: 0xF8D568,
            title: `${emoji} Absence ${statusText}`,
            description:
                status === 'approved'
                    ? 'Your absence request has been approved.'
                    : 'Your absence request has been denied.',
            fields: [
                {
                    name: 'Start Date',
                    value: `\`${updated.startDate}\``,
                    inline: true,
                },
                {
                    name: 'End Date',
                    value: `\`${updated.endDate}\``,
                    inline: true,
                },
                {
                    name: 'Reason',
                    value: `\`${updated.reason}\``,
                    inline: false,
                },
            ],
        };

        await user.send({
            embeds: [dmEmbed],
        }).catch(() => {});
    }

    return interaction.reply({
        content:
            status === 'approved'
                ? 'Absence request approved.'
                : 'Absence request denied.',
        ephemeral: true,
    });
}

export default [
    {
        name: 'absence',
        async execute(interaction) {
            const modal = new ModalBuilder()
                .setCustomId('absence_request')
                .setTitle('Fruity Absence');

            const reason = new TextInputBuilder()
                .setCustomId('absence_reason')
                .setLabel('Reason')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder(
                    'Why do you need to be absent?',
                )
                .setRequired(true)
                .setMaxLength(1000);

            const startDate = new TextInputBuilder()
                .setCustomId('absence_start_date')
                .setLabel('Start Date')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('DD/MM/YYYY')
                .setRequired(true)
                .setMaxLength(10);

            const endDate = new TextInputBuilder()
                .setCustomId('absence_end_date')
                .setLabel('End Date')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('DD/MM/YYYY')
                .setRequired(true)
                .setMaxLength(10);

            modal.addComponents(
                new ActionRowBuilder().addComponents(reason),
                new ActionRowBuilder().addComponents(startDate),
                new ActionRowBuilder().addComponents(endDate),
            );

            await interaction.showModal(modal);
        },
    },

    {
        name: 'absence_approve',
        async execute(interaction, client, args) {
            const requestId = args?.[0];

            if (!requestId) {
                return interaction.reply({
                    content: 'Invalid absence request.',
                    ephemeral: true,
                });
            }

            await handleDecision(
                interaction,
                client,
                requestId,
                'approved',
            );
        },
    },

    {
        name: 'absence_deny',
        async execute(interaction, client, args) {
            const requestId = args?.[0];

            if (!requestId) {
                return interaction.reply({
                    content: 'Invalid absence request.',
                    ephemeral: true,
                });
            }

            await handleDecision(
                interaction,
                client,
                requestId,
                'denied',
            );
        },
    },
];
