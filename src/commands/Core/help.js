// src/commands/Core/help.js

import {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
} from 'discord.js';

import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

const CATEGORY_SELECT_ID = 'help-category-select';
const ALL_COMMANDS_ID = 'help-all-commands';

const CATEGORY_ICONS = {
    Core: 'ℹ️',
    Moderation: '🛡️',
    Economy: '💰',
    Music: '🎵',
    Fun: '🎮',
    Leveling: '📊',
    Utility: '🔧',
    Ticket: '🎫',
    Welcome: '👋',
    Giveaway: '🎉',
    Counter: '🔢',
    Tools: '🛠️',
    Search: '🔍',
    'Reaction Roles': '🎭',
    Community: '👥',
    Birthday: '🎂',
    'Join To Create': '🔌',
    Verification: '✅',
    Config: '⚙️',
    Logging: '📋',
};

function formatCategoryName(category) {
    return category
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function getCommandCategories(client) {
    const categories = new Set();

    try {
        /*
         * Use the commands already loaded by the bot.
         * This avoids importing every command again.
         */
        if (client?.commands?.values) {
            for (const command of client.commands.values()) {
                const category =
                    command.category ||
                    command.categoryName ||
                    command.folder ||
                    command.data?.category;

                if (category) {
                    categories.add(
                        formatCategoryName(String(category)),
                    );
                }
            }
        }

        /*
         * Some command handlers use a Collection named
         * "commands" while others may expose it differently.
         */
        if (
            categories.size === 0 &&
            client?.commands &&
            typeof client.commands === 'object'
        ) {
            for (const command of Object.values(client.commands)) {
                const category =
                    command?.category ||
                    command?.categoryName ||
                    command?.folder ||
                    command?.data?.category;

                if (category) {
                    categories.add(
                        formatCategoryName(String(category)),
                    );
                }
            }
        }
    } catch (error) {
        logger.error(
            'Error collecting help categories:',
            error,
        );
    }

    /*
     * Fallback categories matching the current FruityLLC
     * command structure.
     */
    if (categories.size === 0) {
        [
            'Economy',
            'Fun',
            'Giveaway',
            'Leveling',
            'Logging',
            'Moderation',
            'Ticket',
            'Tools',
            'Utility',
            'Welcome',
        ].forEach((category) => categories.add(category));
    }

    return [...categories].sort((a, b) =>
        a.localeCompare(b),
    );
}

export async function createInitialHelpMenu(client) {
    try {
        const categories =
            await getCommandCategories(client);

        const embed = createEmbed({
            title: '📚 FruityLLC Help',
            description:
                'Welcome to the FruityLLC help menu!\n\n' +
                'Select a category below to view its commands, ' +
                'or choose **All Commands** to browse everything.',
        });

        embed.setFooter({
            text: 'FruityLLC Help System',
        });

        embed.setTimestamp();

        const options = [
            {
                label: 'All Commands',
                description:
                    'View every available command',
                value: ALL_COMMANDS_ID,
                emoji: '📋',
            },
        ];

        for (const category of categories) {
            const icon =
                CATEGORY_ICONS[category] || '🔍';

            options.push({
                label: `${icon} ${category}`.substring(
                    0,
                    100,
                ),
                description:
                    `View ${category} commands`.substring(
                        0,
                        100,
                    ),
                value: category.substring(0, 100),
                emoji: icon,
            });
        }

        /*
         * Discord select menus allow a maximum of 25 options.
         */
        const limitedOptions = options.slice(0, 25);

        const selectMenu =
            new StringSelectMenuBuilder()
                .setCustomId(CATEGORY_SELECT_ID)
                .setPlaceholder(
                    'Select a help category...',
                )
                .setMinValues(1)
                .setMaxValues(1)
                .addOptions(limitedOptions);

        const row =
            new ActionRowBuilder().addComponents(
                selectMenu,
            );

        return {
            embeds: [embed],
            components: [row],
        };
    } catch (error) {
        logger.error(
            'Error creating initial help menu:',
            error,
        );

        const fallbackEmbed = createEmbed({
            title: '📚 FruityLLC Help',
            description:
                'The help menu could not load the command categories. ' +
                'Please try again later.',
        });

        fallbackEmbed.setFooter({
            text: 'FruityLLC Help System',
        });

        fallbackEmbed.setTimestamp();

        return {
            embeds: [fallbackEmbed],
            components: [],
        };
    }
}

const helpCommand = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription(
            'View the FruityLLC help menu.',
        ),

    async execute(interaction, client) {
        try {
            const {
                embeds,
                components,
            } = await createInitialHelpMenu(
                client,
            );

            await interaction.reply({
                embeds,
                components,
            });
        } catch (error) {
            logger.error(
                'Error executing /help:',
                error,
            );

            const errorMessage =
                '❌ An error occurred while opening the help menu.';

            if (
                interaction.deferred ||
                interaction.replied
            ) {
                await interaction.editReply({
                    content: errorMessage,
                    embeds: [],
                    components: [],
                }).catch(() => {});
            } else {
                await interaction.reply({
                    content: errorMessage,
                    ephemeral: true,
                }).catch(() => {});
            }
        }
    },
};
