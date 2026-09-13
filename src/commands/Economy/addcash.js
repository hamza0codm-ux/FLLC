import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { successEmbed, warningEmbed } from '../../utils/embeds.js';

export default {
    data: new SlashCommandBuilder()
        .setName('addcash')
        .setDescription('Add cash to a user\'s wallet (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to add cash to')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Amount of cash to add')
                .setRequired(true)
                .setMinValue(1)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for adding cash')
                .setRequired(false)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const guildId = interaction.guildId;

        if (!guildId) {
            throw createError(
                'Add cash requires a guild',
                ErrorTypes.VALIDATION,
                'This command can only be used in a server.'
            );
        }

        const userData = await getEconomyData(client, guildId, targetUser.id);
        const previousBalance = userData.wallet || 0;

        userData.wallet = (userData.wallet || 0) + amount;

        await setEconomyData(client, guildId, targetUser.id, userData);

        const resultEmbed = successEmbed(
            '💰 Cash Added Successfully',
            `**User:** ${targetUser.tag}\n**Amount Added:** $${amount.toLocaleString()}\n**Previous Balance:** $${previousBalance.toLocaleString()}\n**New Balance:** $${userData.wallet.toLocaleString()}\n**Reason:** ${reason}`
        );

        resultEmbed.setFooter({
            text: `Action performed by ${interaction.user.tag}`,
        });

        await InteractionHelper.safeEditReply(interaction, { embeds: [resultEmbed] });
    }, { command: 'addcash' })
};
