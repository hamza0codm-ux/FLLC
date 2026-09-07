import {
    MessageFlags,
    PermissionFlagsBits,
} from 'discord.js';

import {
    getTicketData,
} from '../../../utils/database.js';

import {
    getGuildConfig,
} from '../../../services/config/guildConfig.js';

import {
    updateTicketPriority,
} from '../../../services/ticket.js';

import {
    successEmbed,
    errorEmbed,
} from '../../../utils/embeds.js';

import {
    logger,
} from '../../../utils/logger.js';


export default {
    name: 'ticket_priority_menu',

    async execute(
        interaction,
        client
    ) {
        try {
            if (
                !interaction.guild ||
                !interaction.channel
            ) {
                return await interaction.reply({
                    embeds: [
                        errorEmbed(
                            'Invalid Location',
                            'This menu can only be used inside a ticket.'
                        ),
                    ],
                    flags:
                        MessageFlags.Ephemeral,
                });
            }

            const ticketData =
                await getTicketData(
                    interaction.guildId,
                    interaction.channelId
                );

            if (!ticketData) {
                return await interaction.reply({
                    embeds: [
                        errorEmbed(
                            'Invalid Ticket',
                            'This is not a valid ticket channel.'
                        ),
                    ],
                    flags:
                        MessageFlags.Ephemeral,
                });
            }

            const config =
                await getGuildConfig(
                    client,
                    interaction.guildId
                );

            const staffRoleId =
                ticketData.staffRoleId ||
                config.ticketStaffRoleId ||
                null;

            const hasManageChannels =
                interaction.member.permissions.has(
                    PermissionFlagsBits.ManageChannels
                );

            const hasStaffRole =
                staffRoleId &&
                interaction.member.roles.cache.has(
                    staffRoleId
                );

            if (
                !hasManageChannels &&
                !hasStaffRole
            ) {
                return await interaction.reply({
                    embeds: [
                        errorEmbed(
                            'Missing Permission',
                            'You need Manage Channels or the ticket staff role to change priority.'
                        ),
                    ],
                    flags:
                        MessageFlags.Ephemeral,
                });
            }

            const priority =
                interaction.values?.[0];

            const validPriorities = [
                'none',
                'low',
                'medium',
                'high',
                'urgent',
            ];

            if (
                !validPriorities.includes(
                    priority
                )
            ) {
                return await interaction.reply({
                    embeds: [
                        errorEmbed(
                            'Invalid Priority',
                            'That priority is not valid.'
                        ),
                    ],
                    flags:
                        MessageFlags.Ephemeral,
                });
            }

            await interaction.deferReply({
                flags:
                    MessageFlags.Ephemeral,
            });

            await updateTicketPriority(
                interaction.channel,
                priority,
                interaction.member
            );

            const label =
                priority === 'none'
                    ? 'None'
                    : priority
                        .charAt(0)
                        .toUpperCase() +
                      priority.slice(1);

            await interaction.editReply({
                embeds: [
                    successEmbed(
                        'Priority Updated',
                        priority === 'none'
                            ? 'Priority has been set to **None** and the priority emoji has been removed from the channel name.'
                            : `Priority has been set to **${label}**. The channel emoji has been updated.`
                    ),
                ],
            });

        } catch (error) {
            logger.error(
                'Error handling ticket priority menu:',
                error
            );

            const payload = {
                embeds: [
                    errorEmbed(
                        'Priority Error',
                        'Something went wrong while changing the ticket priority.'
                    ),
                ],
            };

            if (
                interaction.deferred ||
                interaction.replied
            ) {
                await interaction.editReply(
                    payload
                ).catch(
                    () => null
                );
            } else {
                await interaction.reply({
                    ...payload,
                    flags:
                        MessageFlags.Ephemeral,
                }).catch(
                    () => null
                );
            }
        }
    },
};
