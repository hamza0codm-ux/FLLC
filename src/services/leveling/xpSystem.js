import { EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';

import {
    getLevelingConfig,
    getXpForLevel,
    getUserLevelData,
    saveUserLevelData,
} from './leveling.js';

import {
    logEvent,
    EVENT_TYPES,
} from '../loggingService.js';

import { formatLogLine } from '../../utils/logging/logEmbeds.js';
import { Mutex } from '../../utils/mutex.js';
import { wrapServiceBoundary } from '../../utils/errorHandler.js';

/*
|--------------------------------------------------------------------------
| Fruity Level Rewards
|--------------------------------------------------------------------------
*/

export const LEVEL_REWARDS = {
    5: {
        roleId: '1545924954162470962',
        name: 'Orange',
    },

    10: {
        roleId: '1545924957710852247',
        name: 'Apple',
    },

    15: {
        roleId: '1545924960743198770',
        name: 'Strawberry',
    },

    20: {
        roleId: '1545924963226230885',
        name: 'Watermelon',
    },

    25: {
        roleId: '1545924966267093094',
        name: 'Kiwi',
    },

    30: {
        roleId: '1545924968515108896',
        name: 'Pineapple',
    },

    35: {
        roleId: '1545924970679640085',
        name: 'Peach',
    },

    40: {
        roleId: '1545924973573443667',
        name: 'Banana',
    },

    50: {
        roleId: '1545924976756920430',
        name: 'Mango',
    },

    75: {
        roleId: '1545924979420303522',
        name: 'Cherry',
    },

    100: {
        roleId: '1545924982025093260',
        name: 'DragonFruit',
    },
};

/*
|--------------------------------------------------------------------------
| Level-up channel
|--------------------------------------------------------------------------
*/

const LEVEL_UP_CHANNEL_ID =
    '1546846929676148766';

/*
|--------------------------------------------------------------------------
| Level-up banner
|--------------------------------------------------------------------------
*/

const LEVEL_UP_BANNER =
    'https://media.discordapp.net/attachments/1380169626171871282/1546404727149826058/9.jpg?ex=6aa0faa1&is=6a9fa921&hm=8fce4624c07836bc967b6980c3da4a8b30aab7d6037c27e80f374155effab04b&=&format=webp&width=2048&height=682';

/*
|--------------------------------------------------------------------------
| Weekly Peach multipliers
|--------------------------------------------------------------------------
|
| Level 35+ receives a weekly XP multiplier.
| The multiplier automatically changes every week.
| Everyone receives the same multiplier for the week.
|
|--------------------------------------------------------------------------
*/

const PEACH_WEEKLY_MULTIPLIERS = [
    1.25,
    1.50,
    1.75,
    2.00,
];

/*
|--------------------------------------------------------------------------
| ISO Week
|--------------------------------------------------------------------------
*/

function getISOWeekNumber(date = new Date()) {
    const target = new Date(
        Date.UTC(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
        )
    );

    const dayNumber =
        target.getUTCDay() || 7;

    target.setUTCDate(
        target.getUTCDate() +
        4 -
        dayNumber
    );

    const yearStart =
        new Date(
            Date.UTC(
                target.getUTCFullYear(),
                0,
                1
            )
        );

    return Math.ceil(
        (
            (
                target -
                yearStart
            ) /
            86400000 +
            1
        ) /
        7
    );
}

/*
|--------------------------------------------------------------------------
| Get Peach Multiplier
|--------------------------------------------------------------------------
*/

export function getPeachMultiplier(
    date = new Date()
) {
    const week =
        getISOWeekNumber(date);

    return PEACH_WEEKLY_MULTIPLIERS[
        (week - 1) %
        PEACH_WEEKLY_MULTIPLIERS.length
    ];
}

/*
|--------------------------------------------------------------------------
| Award XP
|--------------------------------------------------------------------------
*/

export const addXp =
    wrapServiceBoundary(
        async function addXp(
            client,
            guild,
            member,
            baseXp
        ) {
            const lockKey =
                `leveling:${guild.id}:${member.user.id}`;

            return await Mutex.runExclusive(
                lockKey,
                async () => {
                    if (
                        !baseXp ||
                        baseXp <= 0
                    ) {
                        return null;
                    }

                    const config =
                        await getLevelingConfig(
                            client,
                            guild.id
                        );

                    if (!config.enabled) {
                        return null;
                    }

                    const levelData =
                        await getUserLevelData(
                            client,
                            guild.id,
                            member.user.id
                        );

                    /*
                    |--------------------------------------------------------------------------
                    | Peach XP Bonus
                    |--------------------------------------------------------------------------
                    */

                    let xpToAdd =
                        Number(baseXp);

                    const currentMultiplier =
                        levelData.level >= 35
                            ? getPeachMultiplier()
                            : 1;

                    xpToAdd =
                        Math.floor(
                            xpToAdd *
                            currentMultiplier
                        );

                    if (xpToAdd <= 0) {
                        return null;
                    }

                    levelData.xp +=
                        xpToAdd;

                    levelData.totalXp +=
                        xpToAdd;

                    levelData.lastMessage =
                        Date.now();

                    let xpNeededForNextLevel =
                        getXpForLevel(
                            levelData.level
                        );

                    let didLevelUp =
                        false;

                    const initialLevel =
                        levelData.level;

                    let reachedReward =
                        null;

                    /*
                    |--------------------------------------------------------------------------
                    | Level Progression
                    |--------------------------------------------------------------------------
                    */

                    while (
                        levelData.xp >=
                            xpNeededForNextLevel &&
                        levelData.level < 1000
                    ) {
                        levelData.xp -=
                            xpNeededForNextLevel;

                        levelData.level += 1;

                        didLevelUp =
                            true;

                        xpNeededForNextLevel =
                            getXpForLevel(
                                levelData.level
                            );

                        logger.info(
                            `🎉 ${member.user.tag} leveled up to level ${levelData.level} in ${guild.name}`
                        );

                        /*
                        |--------------------------------------------------------------------------
                        | Reward Role
                        |--------------------------------------------------------------------------
                        */

                        const reward =
                            LEVEL_REWARDS[
                                levelData.level
                            ];

                        if (reward) {
                            reachedReward =
                                reward;

                            await awardRoleReward(
                                guild,
                                member,
                                reward.roleId,
                                levelData.level
                            );
                        }
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Save Before Announcement
                    |--------------------------------------------------------------------------
                    */

                    await saveUserLevelData(
                        client,
                        guild.id,
                        member.user.id,
                        levelData
                    );

                    /*
                    |--------------------------------------------------------------------------
                    | Level-up Announcement
                    |--------------------------------------------------------------------------
                    */

                    if (didLevelUp) {
                        await sendLevelUpAnnouncement(
                            guild,
                            member,
                            levelData,
                            reachedReward
                        );

                        /*
                        |--------------------------------------------------------------------------
                        | Level-up Logging
                        |--------------------------------------------------------------------------
                        */

                        try {
                            await logEvent({
                                client,

                                guildId:
                                    guild.id,

                                eventType:
                                    EVENT_TYPES.LEVELING_LEVELUP,

                                data: {
                                    title:
                                        'Level Up',

                                    lines: [
                                        formatLogLine(
                                            'Member',
                                            `${member.user.tag} (\`${member.user.id}\`)`
                                        ),

                                        formatLogLine(
                                            'New Level',
                                            levelData.level.toString()
                                        ),

                                        formatLogLine(
                                            'Levels Gained',
                                            (
                                                levelData.level -
                                                initialLevel
                                            ).toString()
                                        ),

                                        formatLogLine(
                                            'Total XP',
                                            levelData.totalXp.toString()
                                        ),

                                        reachedReward
                                            ? formatLogLine(
                                                'Reward',
                                                reachedReward.name
                                            )
                                            : null,
                                    ].filter(Boolean),

                                    userId:
                                        member.user.id,
                                },
                            });
                        } catch (logError) {
                            logger.debug(
                                'Failed to log leveling event:',
                                logError.message
                            );
                        }
                    }

                    return {
                        level:
                            levelData.level,

                        xp:
                            levelData.xp,

                        totalXp:
                            levelData.totalXp,

                        xpNeeded:
                            getXpForLevel(
                                levelData.level
                            ),

                        multiplier:
                            currentMultiplier,

                        reward:
                            reachedReward,

                        leveledUp:
                            didLevelUp,
                    };
                }
            );
        },
        {
            service:
                'xpSystem',

            operation:
                'addXp',

            userMessage:
                'Failed to award XP. Please try again.',
        }
    );

/*
|--------------------------------------------------------------------------
| Award Reward Role
|--------------------------------------------------------------------------
*/

async function awardRoleReward(
    guild,
    member,
    roleId,
    level
) {
    try {
        const role =
            guild.roles.cache.get(
                roleId
            ) ||
            await guild.roles
                .fetch(roleId)
                .catch(() => null);

        if (!role) {
            logger.warn(
                `Role ${roleId} not found for level ${level} reward in guild ${guild.id}`
            );

            return;
        }

        /*
        | Don't add the same role twice.
        */

        if (
            member.roles.cache.has(
                roleId
            )
        ) {
            return;
        }

        await member.roles.add(
            role,
            `Fruity Level ${level} reward`
        );

        logger.info(
            `✅ Awarded ${role.name} to ${member.user.tag} for reaching level ${level}`
        );

    } catch (error) {
        logger.error(
            `Failed to award level ${level} role to ${member.user.id}:`,
            error
        );
    }
}

/*
|--------------------------------------------------------------------------
| Level-up Announcement
|--------------------------------------------------------------------------
*/

async function sendLevelUpAnnouncement(
    guild,
    member,
    levelData,
    reward
) {
    try {
        const channel =
            guild.channels.cache.get(
                LEVEL_UP_CHANNEL_ID
            ) ||
            await guild.channels
                .fetch(
                    LEVEL_UP_CHANNEL_ID
                )
                .catch(() => null);

        if (
            !channel ||
            !channel.isTextBased()
        ) {
            logger.warn(
                `Level-up channel ${LEVEL_UP_CHANNEL_ID} was not found.`
            );

            return;
        }

        /*
        |--------------------------------------------------------------------------
        | Check Permissions
        |--------------------------------------------------------------------------
        */

        const permissions =
            channel.permissionsFor(
                guild.members.me
            );

        if (
            !permissions ||
            !permissions.has([
                'SendMessages',
                'EmbedLinks',
            ])
        ) {
            logger.warn(
                `Missing permissions for level-up channel ${LEVEL_UP_CHANNEL_ID}`
            );

            return;
        }

        /*
        |--------------------------------------------------------------------------
        | Reward Display
        |--------------------------------------------------------------------------
        |
        | If the user reached a reward level, mention
        | the actual Discord role.
        |
        | Example:
        |
        | Congrats @Ghost you level up'ed to <@&123456789>!
        |
        |--------------------------------------------------------------------------
        */

      const rewardText =
    reward
        ? `**${reward.name}**`
        : `**Level ${levelData.level}**`;
        
        const embed =
            new EmbedBuilder()
                .setColor(0xF8D568)

                .setDescription(
                    `Congrats ${member} you level up'ed to ${rewardText}!`
                )

                .setImage(
                    LEVEL_UP_BANNER
                )

                .setTimestamp();

        await channel.send({
            embeds: [
                embed
            ],
  allowedMentions: {
        users: [
            member.user.id
        ],
    },
});

    } catch (error) {
        logger.error(
            'Error sending level-up announcement:',
            error
        );
    }
}
