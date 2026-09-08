import {
    SlashCommandBuilder,
    EmbedBuilder,
} from 'discord.js';

import {
    getLevelingConfig,
    getUserLevelData,
    getLeaderboard,
    getXpForLevel,
} from '../../services/leveling/leveling.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Check your level or another member\'s level')
        .setDMPermission(false)
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The member whose level you want to check')
                .setRequired(false)
        ),

    category: 'Leveling',

    async execute(interaction, config, client) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const guildId = interaction.guildId;

            const targetUser =
                interaction.options.getUser('user') ||
                interaction.user;

            const levelingConfig =
                await getLevelingConfig(client, guildId);

            if (levelingConfig?.enabled === false) {
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xF8D568)
                            .setTitle('Leveling Disabled')
                            .setDescription(
                                'The leveling system is currently disabled.'
                            ),
                    ],
                });

                return;
            }

            const data = await getUserLevelData(
                client,
                guildId,
                targetUser.id
            );

            const currentLevel = data.level || 0;
            const currentXp = data.xp || 0;
            const totalXp = data.totalXp || 0;

            const xpNeeded =
                getXpForLevel(currentLevel);

            const progress =
                xpNeeded > 0
                    ? Math.min(
                        100,
                        Math.floor(
                            (currentXp / xpNeeded) * 100
                        )
                    )
                    : 100;

            const leaderboard =
                await getLeaderboard(
                    client,
                    guildId,
                    100
                );

            const rank =
                leaderboard.findIndex(
                    entry =>
                        entry.userId === targetUser.id
                ) + 1;

            const rewardRoles = {
                5: '1545924954162470962',
                10: '1545924957710852247',
                15: '1545924960743198770',
                20: '1545924963226230885',
                25: '1545924966267093094',
                30: '1545924968515108896',
                35: '1545924970679640085',
                40: '1545924973573443667',
                50: '1545924976756920430',
                75: '1545924979420303522',
                100: '1545924982025093260',
            };

            const reachedRewards = Object.entries(rewardRoles)
                .filter(([level]) =>
                    currentLevel >= Number(level)
                )
                .sort(
                    (a, b) =>
                        Number(b[0]) - Number(a[0])
                );

            let currentRank = 'No reward rank yet.';

            if (reachedRewards.length > 0) {
                const [rewardLevel, roleId] =
                    reachedRewards[0];

                const role =
                    interaction.guild.roles.cache.get(
                        roleId
                    );

                currentRank =
                    role
                        ? `${role}`
                        : `Level ${rewardLevel}`;
            }

            const progressBlocks = 10;
            const filledBlocks = Math.round(
                (progress / 100) *
                progressBlocks
            );

            const progressBar =
                '▰'.repeat(filledBlocks) +
                '▱'.repeat(
                    progressBlocks - filledBlocks
                );

            const embed =
                new EmbedBuilder()
                    .setColor(0xF8D568)
                    .setAuthor({
                        name: targetUser.tag,
                        iconURL:
                            targetUser.displayAvatarURL({
                                extension: 'png',
                                size: 128,
                            }),
                    })
                    .setTitle(
                        `${targetUser.username}'s Level`
                    )
                    .setDescription(
                        `**Level ${currentLevel}**\n\n` +
                        `${progressBar} **${progress}%**`
                    )
                    .addFields(
                        {
                            name: 'XP',
                            value:
                                `**${currentXp.toLocaleString()}** / ` +
                                `**${xpNeeded.toLocaleString()}**`,
                            inline: true,
                        },
                        {
                            name: 'Total XP',
                            value:
                                `**${totalXp.toLocaleString()}**`,
                            inline: true,
                        },
                        {
                            name: 'Server Rank',
                            value:
                                rank > 0
                                    ? `#${rank}`
                                    : 'Unranked',
                            inline: true,
                        },
                        {
                            name: 'Current Reward',
                            value: currentRank,
                            inline: true,
                        }
                    )
                    .setFooter({
                        text:
                            targetUser.id === interaction.user.id
                                ? 'Keep chatting to earn more XP!'
                                : 'Fruity Leveling System',
                    })
                    .setTimestamp();

            await InteractionHelper.safeEditReply(
                interaction,
                {
                    embeds: [embed],
                }
            );
        } catch (error) {
            logger.error(
                'Error executing /level:',
                error
            );

            await InteractionHelper.safeEditReply(
                interaction,
                {
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xED4245)
                            .setTitle('Level Error')
                            .setDescription(
                                'I could not retrieve that member\'s level.'
                            ),
                    ],
                }
            ).catch(() => {});
        }
    },
};
