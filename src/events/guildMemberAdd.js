// src/events/guildMemberAdd.js

import {
    Events,
    EmbedBuilder,
    PermissionFlagsBits,
} from 'discord.js';

import {
    logEvent,
    EVENT_TYPES,
} from '../services/loggingService.js';

import {
    getServerCounters,
    updateCounter,
} from '../services/serverstatsService.js';

import {
    logger,
} from '../utils/logger.js';


// ---------------------------------------------------------------------------
// Fruity Welcome Configuration
// ---------------------------------------------------------------------------

const WELCOME_CHANNEL_ID = '1541550434077114418';

const AUTO_ROLE_ID = '1541554587658625104';

const WAVE_EMOJI = '<a:Wave:1545873275635109972>';
const HEART_EMOJI = '<a:Heart:1546417452915757076>';

const WELCOME_CHANNELS = [
    '<#1541550498925256744>',
    '<#1545439852487778455>',
    '<#1541550578495127592>',
    '<#1541551382958579782>',
    '<#1543030791599300759>',
];


// ---------------------------------------------------------------------------
// Member Join
// ---------------------------------------------------------------------------

export default {
    name: Events.GuildMemberAdd,
    once: false,

    async execute(member) {
        const { guild, user } = member;

        try {

            // ----------------------------------------------------------------
            // Welcome Message
            // ----------------------------------------------------------------

            try {
                const channel = guild.channels.cache.get(WELCOME_CHANNEL_ID);

                if (!channel) {
                    logger.warn(
                        `Welcome channel ${WELCOME_CHANNEL_ID} was not found in guild ${guild.id}.`
                    );
                } else if (!channel.isTextBased()) {
                    logger.warn(
                        `Welcome channel ${WELCOME_CHANNEL_ID} is not a text-based channel.`
                    );
                } else {
                    const botMember = guild.members.me;

                    const permissions = botMember
                        ? channel.permissionsFor(botMember)
                        : null;

                    if (
                        !permissions?.has(PermissionFlagsBits.ViewChannel) ||
                        !permissions?.has(PermissionFlagsBits.SendMessages)
                    ) {
                        logger.warn(
                            `Missing permissions to send welcome message in ${WELCOME_CHANNEL_ID}.`
                        );
                    } else if (
                        !permissions.has(PermissionFlagsBits.EmbedLinks)
                    ) {
                        logger.warn(
                            `Missing Embed Links permission in welcome channel ${WELCOME_CHANNEL_ID}.`
                        );

                        // Still send the mention if embeds cannot be used.
                        await channel.send({
                            content:
                                `${user}\n\n` +
                                `${WAVE_EMOJI}  **Welcome to Fruity!**\n` +
                                `We’re so excited to have you join us, make sure to check out all the essential channels to get the full experience!\n\n` +
                                `${WELCOME_CHANNELS.join('\n')}\n\n` +
                                `Hope you enjoy your stay here ${HEART_EMOJI}`,
                        });
                    } else {

                        const welcomeEmbed = new EmbedBuilder()
                            .setDescription(
                                `${WAVE_EMOJI}  **Welcome to Fruity!**\n\n` +
                                `We’re so excited to have you join us, make sure to check out all the essential channels to get the full experience!\n\n` +
                                `${WELCOME_CHANNELS.join('\n')}\n\n` +
                                `Hope you enjoy your stay here ${HEART_EMOJI}`
                            )
                            .setThumbnail(
                                user.displayAvatarURL({
                                    size: 256,
                                })
                            )
                            .setTimestamp();

                        await channel.send({
                            content: user.toString(),
                            embeds: [welcomeEmbed],
                        });
                    }
                }

            } catch (welcomeError) {
                logger.error(
                    `Failed to send welcome message for ${user.id}:`,
                    welcomeError
                );
            }


            // ----------------------------------------------------------------
            // Automatic Role
            // ----------------------------------------------------------------

            try {
                const role = guild.roles.cache.get(AUTO_ROLE_ID);

                if (!role) {
                    logger.warn(
                        `Auto role ${AUTO_ROLE_ID} was not found in guild ${guild.id}.`
                    );
                } else if (!guild.members.me) {
                    logger.warn(
                        `Bot member could not be found in guild ${guild.id}.`
                    );
                } else if (
                    !guild.members.me.permissions.has(
                        PermissionFlagsBits.ManageRoles
                    )
                ) {
                    logger.warn(
                        `Bot does not have Manage Roles permission in guild ${guild.id}.`
                    );
                } else if (
                    role.position >= guild.members.me.roles.highest.position
                ) {
                    logger.warn(
                        `Cannot assign auto role ${AUTO_ROLE_ID} because it is higher than or equal to the bot's highest role.`
                    );
                } else {
                    await member.roles.add(
                        role,
                        'Automatic Fruity member role'
                    );

                    logger.info(
                        `Automatically assigned role ${AUTO_ROLE_ID} to ${user.tag} (${user.id})`
                    );
                }

            } catch (roleError) {
                logger.error(
                    `Failed to assign auto role to ${user.id}:`,
                    roleError
                );
            }


            // ----------------------------------------------------------------
            // Logging
            // ----------------------------------------------------------------

            try {
                await logEvent({
                    client: member.client,
                    guildId: guild.id,
                    eventType: EVENT_TYPES.MEMBER_JOIN,

                    data: {
                        title: 'User joined',

                        lines: [
                            `**User:** ${user.toString()} (${user.tag})`,
                            `**ID:** \`${user.id}\``,
                            `**Created:** <t:${Math.floor(
                                user.createdTimestamp / 1000
                            )}:R>`,
                            `**Members:** ${guild.memberCount}`,
                        ],

                        quoted: false,

                        thumbnail: user.displayAvatarURL({
                            dynamic: true,
                        }),

                        userId: user.id,
                    },
                });

            } catch (loggingError) {
                logger.debug(
                    'Error logging member join:',
                    loggingError
                );
            }


            // ----------------------------------------------------------------
            // Server Counters
            // ----------------------------------------------------------------

            try {
                const counters = await getServerCounters(
                    member.client,
                    guild.id
                );

                for (const counter of counters) {
                    if (
                        counter &&
                        counter.type &&
                        counter.channelId &&
                        counter.enabled !== false
                    ) {
                        await updateCounter(
                            member.client,
                            guild,
                            counter
                        );
                    }
                }

            } catch (counterError) {
                logger.debug(
                    'Error updating counters on member join:',
                    counterError
                );
            }

        } catch (error) {
            logger.error(
                `Error in guildMemberAdd event for ${user.id}:`,
                error
            );
        }
    },
};
