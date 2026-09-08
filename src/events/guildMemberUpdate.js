import { Events } from 'discord.js';
import { logEvent, EVENT_TYPES } from '../services/loggingService.js';
import { logger } from '../utils/logger.js';

const BOOSTER_PERKS_ROLE_ID = '1546478149687316510';

function getBoostCountKey(guildId, userId) {
  return `guild:${guildId}:boosts:${userId}`;
}

function unwrapData(data) {
  if (
    typeof data === 'object' &&
    data !== null &&
    data.ok !== undefined &&
    data.value !== undefined
  ) {
    return unwrapData(data.value);
  }

  return data;
}

export default {
  name: Events.GuildMemberUpdate,
  once: false,

  async execute(oldMember, newMember) {
    try {
      if (!newMember?.guild) return;

      const client = newMember.client;

      /*
       * ============================================================
       * BOOST TRACKING
       * ============================================================
       *
       * A new boost happens when:
       *
       * oldMember.premiumSince === null
       * AND
       * newMember.premiumSince !== null
       *
       * This lets us count every new time they start boosting.
       */

      const startedBoosting =
        !oldMember.premiumSince &&
        !!newMember.premiumSince;

      if (startedBoosting) {
        try {
          if (!client.db) {
            logger.error(
              `[BOOST] Database unavailable for ${newMember.user.tag}`
            );
          } else {
            const boostKey = getBoostCountKey(
              newMember.guild.id,
              newMember.user.id
            );

            const rawCount = await client.db.get(boostKey, 0);
            const oldCount = Number(unwrapData(rawCount)) || 0;

            const newCount = oldCount + 1;

            await client.db.set(boostKey, newCount);

            logger.info(
              `[BOOST] ${newMember.user.tag} reached boost #${newCount}`
            );

            /*
             * 1st boost:
             * Discord automatically handles the normal Booster role.
             *
             * 2nd boost and onward:
             * Give the special 2+ Boosters role.
             *
             * This role remains even if they later stop boosting,
             * because the user has historically reached 2+ boosts.
             */
            if (newCount >= 2) {
              const perksRole = newMember.guild.roles.cache.get(
                BOOSTER_PERKS_ROLE_ID
              );

              if (!perksRole) {
                logger.error(
                  `[BOOST] Could not find 2+ Boosters role ${BOOSTER_PERKS_ROLE_ID}`
                );
              } else if (!newMember.roles.cache.has(BOOSTER_PERKS_ROLE_ID)) {
                await newMember.roles.add(
                  perksRole,
                  `Reached ${newCount} server boosts`
                );

                logger.info(
                  `[BOOST] Added 2+ Boosters role to ${newMember.user.tag}`
                );
              }
            }
          }
        } catch (boostError) {
          logger.error(
            `[BOOST] Error processing boost for ${newMember.user.tag}:`,
            boostError
          );
        }
      }

      /*
       * ============================================================
       * EXISTING NICKNAME LOGGING
       * ============================================================
       */

      if (oldMember.nickname !== newMember.nickname) {
        await logEvent({
          client,
          guildId: newMember.guild.id,
          eventType: EVENT_TYPES.MEMBER_NAME_CHANGE,
          data: {
            title: 'Nickname changed',
            lines: [
              `**User:** ${newMember.user.toString()} (${newMember.user.tag})`,
              `**ID:** \`${newMember.user.id}\``,
              `**Before:** ${oldMember.nickname || '*(no nickname)*'}`,
              `**After:** ${newMember.nickname || '*(no nickname)*'}`,
            ],
            thumbnail: newMember.user.displayAvatarURL({
              dynamic: true,
            }),
            userId: newMember.user.id,
          },
        });
      }

    } catch (error) {
      logger.error(
        'Error in guildMemberUpdate event:',
        error
      );
    }
  },
};
