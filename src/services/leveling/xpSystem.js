import { logger } from '../../utils/logger.js';

import {
    getLevelingConfig,
    getUserLevel,
    saveUserLevel,
    getXpForLevel,
} from './leveling.js';

import { getLevelingUserKey } from './leveling.js';

import {
    getLoggingConfig,
    logEvent,
} from '../logging/loggingService.js';

import { formatLogLine } from '../../utils/logFormatter.js';
import { Mutex } from '../../utils/mutex.js';
import { wrapServiceBoundary } from '../../utils/serviceBoundary.js';


// ============================================================
// LEVEL REWARDS
// ============================================================

export const LEVEL_REWARDS = [
    {
        level: 5,
        roleId: '1545924954162470962',
        name: 'Orange',
    },
    {
        level: 10,
        roleId: '1545924957710852247',
        name: 'Apple',
    },
    {
        level: 15,
        roleId: '1545924960743198770',
        name: 'Strawberry',
    },
    {
        level: 20,
        roleId: '1545924963226230885',
        name: 'Watermelon',
    },
    {
        level: 25,
        roleId: '1545924966267093094',
        name: 'Kiwi',
    },
    {
        level: 30,
        roleId: '1545924968515108896',
        name: 'Pineapple',
    },
    {
        level: 35,
        roleId: '1545924970679640085',
        name: 'Peach',
    },
    {
        level: 40,
        roleId: '1545924973573443667',
        name: 'Banana',
    },
    {
        level: 50,
        roleId: '1545924976756920430',
        name: 'Mango',
    },
    {
        level: 75,
        roleId: '1545924979420303522',
        name: 'Cherry',
    },
    {
        level: 100,
        roleId: '1545924982025093260',
        name: 'DragonFruit',
    },
];


// ============================================================
// LEVEL-UP ANNOUNCEMENT
// ============================================================

const LEVEL_UP_CHANNEL_ID = '1546846929676148766';

const LEVEL_UP_BANNER =
    'https://media.discordapp.net/attachments/1380169626171871282/1546404727149826058/9.jpg?ex=6aa0faa1&is=6a9fa921&hm=8f35ce4624c078bc967b6980c3da4a8b30aab7d6037c27e80f374155effab04b&=&format=webp&width=2048&height=682';


// ============================================================
// PEACH WEEKLY XP MULTIPLIER
// ============================================================

const PEACH_WEEKLY_MULTIPLIERS = [
    1.25,
    1.50,
    1.75,
    2.00,
];

function getISOWeekNumber(date = new Date()) {
    const target = new Date(
        Date.UTC(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
        )
    );

    const dayNumber = target.getUTCDay() || 7;

    target.setUTCDate(
        target.getUTCDate() + 4 - dayNumber
    );

    const yearStart = new Date(
        Date.UTC(
            target.getUTCFullYear(),
            0,
            1
        )
    );

    return Math.ceil(
        (
            (
                (target - yearStart) / 86400000
            ) + 1
        ) / 7
    );
}


function getPeachMultiplier() {
    const week = getISOWeekNumber();

    return PEACH_WEEKLY_MULTIPLIERS[
        (week - 1) % PEACH_WEEKLY_MULTIPLIERS.length
    ];
}


// ============================================================
// XP MUTEX
// ============================================================

const xpMutexes = new Map();

function getXpMutex(guildId, userId) {
    const key = `${guildId}:${userId}`;

    if (!xpMutexes.has(key)) {
        xpMutexes.set(key, new Mutex());
    }

    return xpMutexes.get(key);
}


// ============================================================
// ADD XP
// ============================================================

export const addXp = wrapServiceBoundary(
    async (
        client,
        guildId,
        userId,
        amount,
        member = null
    ) => {
        const mutex = getXpMutex(guildId, userId);

        return mutex.runExclusive(async () => {
            const levelingConfig =
                await getLevelingConfig(
                    client,
                    guildId
                );

            if (!levelingConfig?.enabled) {
                return null;
            }

            let levelData =
                await getUserLevel(
                    client,
                    guildId,
                    userId
                );

            if (!levelData) {
                levelData = {
                    level: 0,
                    xp: 0,
                    totalXp: 0,
                    lastMessage: null,
                };
            }

            // ====================================================
            // PEACH MULTIPLIER
            // ====================================================

            let multiplier = 1;

            if (levelData.level >= 35) {
                multiplier = getPeachMultiplier();
            }

            const boostedAmount = Math.floor(
                amount * multiplier
            );

            levelData.xp += boostedAmount;
            levelData.totalXp += boostedAmount;
            levelData.lastMessage = Date.now();

            let leveledUp = false;
            let reward = null;

            // ====================================================
            // LEVEL UP
            // ====================================================

            while (
                levelData.level < 1000 &&
                levelData.xp >=
                    getXpForLevel(levelData.level)
            ) {
                levelData.xp -=
                    getXpForLevel(levelData.level);

                levelData.level += 1;
                leveledUp = true;

                const newReward =
                    LEVEL_REWARDS.find(
                        rewardItem =>
                            rewardItem.level ===
                            levelData.level
                    );

                if (newReward) {
                    reward = newReward;
                }
            }

            // ====================================================
            // SAVE FIRST
            // ====================================================

            await saveUserLevel(
                client,
                guildId,
                userId,
                levelData
            );

            // ====================================================
            // HANDLE LEVEL REWARD
            // ====================================================

            if (
                leveledUp &&
                reward &&
                member
            ) {
                await awardRoleReward(
                    member,
                    reward
                );
            }

            // ====================================================
            // LEVEL-UP ANNOUNCEMENT
            // ====================================================

            if (leveledUp && member) {
                await sendLevelUpAnnouncement(
                    member,
                    levelData,
                    reward
                );
            }

            // ====================================================
            // LOG
            // ====================================================

            if (leveledUp) {
                try {
                    await logEvent({
                        client,
                        guildId,
                        type: 'LEVEL_UP',
                        userId,
                        data: {
                            level: levelData.level,
                            reward: reward?.name ?? null,
                        },
                    });
                } catch (error) {
                    logger.warn(
                        `Failed to log level-up for ${userId}:`,
                        error
                    );
                }
            }

            return {
                level: levelData.level,
                xp: levelData.xp,
                totalXp: levelData.totalXp,
                xpNeeded: getXpForLevel(
                    levelData.level
                ),
                multiplier,
                reward,
                leveledUp,
            };
        });
    },
    {
        name: 'addXp',
    }
);


// ============================================================
// AWARD LEVEL ROLE
// ============================================================

async function awardRoleReward(member, reward) {
    if (!reward?.roleId) {
        return;
    }

    try {
        const levelingRoleIds =
            LEVEL_REWARDS
                .map(rewardItem => rewardItem.roleId)
                .filter(Boolean);

        // --------------------------------------------------------
        // Remove ALL previous leveling roles
        // --------------------------------------------------------

        const previousRoles =
            member.roles.cache.filter(
                role =>
                    levelingRoleIds.includes(role.id) &&
                    role.id !== reward.roleId
            );

        for (const role of previousRoles.values()) {
            try {
                await member.roles.remove(
                    role.id,
                    'Leveling: replacing previous reward role'
                );
            } catch (error) {
                logger.warn(
                    `Failed to remove old leveling role ${role.id} from ${member.user.tag}:`,
                    error
                );
            }
        }

        // --------------------------------------------------------
        // Add the new highest/current leveling role
        // --------------------------------------------------------

        if (
            !member.roles.cache.has(
                reward.roleId
            )
        ) {
            await member.roles.add(
                reward.roleId,
                `Level ${reward.level} reward`
            );
        }

        logger.debug(
            `Level reward updated for ${member.user.tag}: ${reward.name}`
        );
    } catch (error) {
        logger.error(
            `Failed to award level reward ${reward.name} to ${member.user.tag}:`,
            error
        );
    }
}


// ============================================================
// LEVEL-UP ANNOUNCEMENT
// ============================================================

async function sendLevelUpAnnouncement(
    member,
    levelData,
    reward
) {
    try {
        const channel =
            await member.client.channels.fetch(
                LEVEL_UP_CHANNEL_ID
            );

        if (!channel) {
            logger.warn(
                `Level-up channel ${LEVEL_UP_CHANNEL_ID} not found.`
            );
            return;
        }

        if (!channel.isTextBased()) {
            logger.warn(
                `Level-up channel ${LEVEL_UP_CHANNEL_ID} is not text-based.`
            );
            return;
        }

        const rewardText = reward
            ? `**${reward.name}**`
            : `**Level ${levelData.level}**`;

        const embed = {
            color: 0xf1c40f,
            description:
                `Congrats ${member} you level up'ed to ${rewardText}!`,
            image: {
                url: LEVEL_UP_BANNER,
            },
            footer: {
                text: `Level ${levelData.level}`,
            },
        };

        await channel.send({
            content: `<@${member.user.id}>`,
            embeds: [embed],
            allowedMentions: {
                users: [
                    member.user.id,
                ],
            },
        });
    } catch (error) {
        logger.error(
            `Failed to send level-up announcement for ${member.user.tag}:`,
            error
        );
    }
}


// ============================================================
// EXPORT HELPERS
// ============================================================

export {
    getPeachMultiplier,
    getISOWeekNumber,
};
```

### What changed

The important part is now:

```js
const previousRoles =
    member.roles.cache.filter(
        role =>
            levelingRoleIds.includes(role.id) &&
            role.id !== reward.roleId
    );

for (const role of previousRoles.values()) {
    await member.roles.remove(role.id);
}
