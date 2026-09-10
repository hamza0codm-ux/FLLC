import {
    createAbsenceRequest,
} from '../../services/absenceService.js';

function parseDate(value) {
    const input = value.trim();

    let day;
    let month;
    let year;

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(input)) {
        [day, month, year] = input
            .split('/')
            .map(Number);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
        [year, month, day] = input
            .split('-')
            .map(Number);
    } else {
        return null;
    }

    const date = new Date(
        Date.UTC(
            year,
            month - 1,
            day,
        ),
    );

    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null;
    }

    return date;
}

function formatDate(date) {
    const day = String(
        date.getUTCDate(),
    ).padStart(2, '0');

    const month = String(
        date.getUTCMonth() + 1,
    ).padStart(2, '0');

    const year = date.getUTCFullYear();

    return `${day}/${month}/${year}`;
}

export default {
    name: 'absence_request',

    async execute(interaction, client) {
        const reason = interaction.fields
            .getTextInputValue('absence_reason')
            .trim();

        const rawStartDate = interaction.fields
            .getTextInputValue('absence_start_date')
            .trim();

        const rawEndDate = interaction.fields
            .getTextInputValue('absence_end_date')
            .trim();

        if (!reason) {
            return interaction.reply({
                content:
                    'Please provide a reason for your absence.',
                ephemeral: true,
            });
        }

        const startDate = parseDate(
            rawStartDate,
        );

        const endDate = parseDate(
            rawEndDate,
        );

        if (!startDate) {
            return interaction.reply({
                content:
                    'The start date is invalid. Use **DD/MM/YYYY**.',
                ephemeral: true,
            });
        }

        if (!endDate) {
            return interaction.reply({
                content:
                    'The end date is invalid. Use **DD/MM/YYYY**.',
                ephemeral: true,
            });
        }

        if (endDate < startDate) {
            return interaction.reply({
                content:
                    'The end date cannot be before the start date.',
                ephemeral: true,
            });
        }

        await interaction.deferReply({
            ephemeral: true,
        });

        try {
            const request = await createAbsenceRequest(
                client,
                interaction.guildId,
                interaction.user,
                reason,
                formatDate(startDate),
                formatDate(endDate),
            );

            await interaction.editReply({
                content:
                    '<a:Yes:1545795445043888239> ' +
                    'Your absence request has been submitted for review.',
            });
        } catch (error) {
            await interaction.editReply({
                content:
                    '❌ I could not submit your absence request. ' +
                    'Please try again later.',
            });

            throw error;
        }
    },
};
