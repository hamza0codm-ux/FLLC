// src/services/suggestionPanelService.js

import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PUBLIC_CHANNEL_ID = '1545071209429999736';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATE_FILE = path.join(
    __dirname,
    '../../data/suggestionPanel.json'
);

const SUGGESTION_EMOJI = {
    name: 'Suggestion',
    id: '1546240756073893950',
    animated: true,
};

const LOADING_EMOJI = {
    name: 'Loading',
    id: '1546268064008642641',
    animated: true,
};

const PANEL_IMAGE =
    'https://media.discordapp.net/attachments/1380169626171871282/1546564480840892446/content.png?ex=6aa03dea&is=6a9eec6a&hm=045e45dbe397a20550ffef10a28971d4f7db835c0c16d70109930216eddd15cf&=&format=webp&quality=lossless&width=768&height=256';

function buildSuggestionPanel() {
    const embed = new EmbedBuilder()
        .setColor('#F8D568')
        .setTitle('Have your ideas heard at Fruity')
        .setDescription(
            'Have an idea, improvement, or suggestion for Fruity?\n' +
            'We want to hear what you think.\n' +
            'Submit your idea below and our Management team will review it.'
        )
        .setImage(PANEL_IMAGE);

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('suggestion:submit')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(SUGGESTION_EMOJI)
            .setLabel('Submit'),

        new ButtonBuilder()
            .setCustomId('suggestion:status')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(LOADING_EMOJI)
            .setLabel('My status')
    );

    return {
        embeds: [embed],
        components: [buttons],
    };
}

function getPanelHash() {
    const panel = buildSuggestionPanel();

    const data = {
        embeds: panel.embeds.map(embed => embed.toJSON()),
        components: panel.components.map(component =>
            component.toJSON()
        ),
    };

    return crypto
        .createHash('sha256')
        .update(JSON.stringify(data))
        .digest('hex');
}

function loadState() {
    try {
        if (!fs.existsSync(STATE_FILE)) {
            return null;
        }

        return JSON.parse(
            fs.readFileSync(STATE_FILE, 'utf8')
        );
    } catch {
        return null;
    }
}

function saveState(state) {
    const directory = path.dirname(STATE_FILE);

    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, {
            recursive: true,
        });
    }

    fs.writeFileSync(
        STATE_FILE,
        JSON.stringify(state, null, 2)
    );
}

async function findPanelById(channel, messageId) {
    if (!messageId) {
        return null;
    }

    try {
        return await channel.messages.fetch(messageId);
    } catch {
        return null;
    }
}

async function findExistingSuggestionPanel(channel, client) {
    const messages = await channel.messages.fetch({
        limit: 100,
    });

    return (
        messages.find(message => {
            if (message.author?.id !== client.user.id) {
                return false;
            }

            return message.components?.some(row =>
                row.components?.some(
                    component =>
                        component.customId ===
                            'suggestion:submit' ||
                        component.customId ===
                            'suggestion:status'
                )
            );
        }) || null
    );
}

export async function reconcileSuggestionPanel(client) {
    try {
        const channel = await client.channels.fetch(
            PUBLIC_CHANNEL_ID
        );

        if (!channel || !channel.isTextBased()) {
            throw new Error(
                `Suggestion channel ${PUBLIC_CHANNEL_ID} could not be found.`
            );
        }

        const currentHash = getPanelHash();
        const state = loadState();

        /*
         * ============================================
         * FIRST RUN
         * ============================================
         *
         * If we already know the panel and its hash,
         * check that exact message.
         */
        if (state?.messageId && state?.hash) {
            const existingPanel = await findPanelById(
                channel,
                state.messageId
            );

            // Panel still exists and nothing changed.
            if (
                existingPanel &&
                state.hash === currentHash
            ) {
                return {
                    action: 'unchanged',
                    messageId: existingPanel.id,
                    channelId: channel.id,
                };
            }

            /*
             * The code changed.
             *
             * Send the new panel FIRST.
             */
            if (state.hash !== currentHash) {
                const newPanel = await channel.send(
                    buildSuggestionPanel()
                );

                /*
                 * Only after the new panel successfully
                 * exists do we delete the old one.
                 */
                if (existingPanel) {
                    try {
                        await existingPanel.delete(
                            'Suggestion panel updated'
                        );
                    } catch (error) {
                        console.warn(
                            'Could not delete old suggestion panel:',
                            error
                        );
                    }
                }

                saveState({
                    messageId: newPanel.id,
                    hash: currentHash,
                });

                return {
                    action: 'replaced',
                    oldMessageId:
                        existingPanel?.id ?? null,
                    messageId: newPanel.id,
                    channelId: channel.id,
                };
            }

            /*
             * State exists but old panel was deleted.
             * Create a replacement.
             */
            const newPanel = await channel.send(
                buildSuggestionPanel()
            );

            saveState({
                messageId: newPanel.id,
                hash: currentHash,
            });

            return {
                action: 'created',
                messageId: newPanel.id,
                channelId: channel.id,
            };
        }

        /*
         * ============================================
         * MIGRATION / FIRST RUN
         * ============================================
         *
         * We don't have a saved state yet.
         *
         * IMPORTANT:
         * If the panel already exists, DON'T replace it.
         *
         * Simply remember its ID and the current code hash.
         */
        const existingPanel =
            await findExistingSuggestionPanel(
                channel,
                client
            );

        if (existingPanel) {
            saveState({
                messageId: existingPanel.id,
                hash: currentHash,
            });

            return {
                action: 'unchanged',
                messageId: existingPanel.id,
                channelId: channel.id,
            };
        }

        /*
         * No panel exists at all.
         */
        const newPanel = await channel.send(
            buildSuggestionPanel()
        );

        saveState({
            messageId: newPanel.id,
            hash: currentHash,
        });

        return {
            action: 'created',
            messageId: newPanel.id,
            channelId: channel.id,
        };
    } catch (error) {
        return {
            action: 'error',
            messageId: null,
            channelId: PUBLIC_CHANNEL_ID,
            error: error.message,
        };
    }
}
