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

// ============================================================
// ERROR HELPER
// ============================================================

function getErrorMessage(error) {
    if (error instanceof Error) {
        return error.stack || error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    try {
        return JSON.stringify(error, null, 2);
    } catch {
        return String(error);
    }
}

// ============================================================
// BUILD PANEL
// ============================================================

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

// ============================================================
// PANEL HASH
// ============================================================

function getPanelHash() {
    const panel = buildSuggestionPanel();

    const data = {
        embeds: panel.embeds.map(embed =>
            embed.toJSON()
        ),

        components: panel.components.map(component =>
            component.toJSON()
        ),
    };

    return crypto
        .createHash('sha256')
        .update(JSON.stringify(data))
        .digest('hex');
}

// ============================================================
// STATE
// ============================================================

function loadState() {
    try {
        if (!fs.existsSync(STATE_FILE)) {
            return null;
        }

        const raw = fs.readFileSync(
            STATE_FILE,
            'utf8'
        );

        if (!raw.trim()) {
            return null;
        }

        return JSON.parse(raw);
    } catch (error) {
        console.warn(
            '[SuggestionPanel] Failed to load state:',
            getErrorMessage(error)
        );

        return null;
    }
}

function saveState(state) {
    try {
        const directory = path.dirname(
            STATE_FILE
        );

        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, {
                recursive: true,
            });
        }

        fs.writeFileSync(
            STATE_FILE,
            JSON.stringify(state, null, 2),
            'utf8'
        );

        return true;
    } catch (error) {
        console.error(
            '[SuggestionPanel] Failed to save state:',
            getErrorMessage(error)
        );

        return false;
    }
}

// ============================================================
// FIND PANEL BY MESSAGE ID
// ============================================================

async function findPanelById(
    channel,
    messageId
) {
    if (!messageId) {
        return null;
    }

    try {
        return await channel.messages.fetch(
            messageId
        );
    } catch (error) {
        console.warn(
            `[SuggestionPanel] Could not fetch panel ${messageId}:`,
            getErrorMessage(error)
        );

        return null;
    }
}

// ============================================================
// FIND EXISTING PANEL
// ============================================================

async function findExistingSuggestionPanel(
    channel,
    client
) {
    try {
        const messages =
            await channel.messages.fetch({
                limit: 100,
            });

        return (
            messages.find(message => {
                if (
                    message.author?.id !==
                    client.user?.id
                ) {
                    return false;
                }

                return message.components?.some(
                    row =>
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
    } catch (error) {
        console.error(
            '[SuggestionPanel] Failed to search for existing panel:',
            getErrorMessage(error)
        );

        throw error;
    }
}

// ============================================================
// RECONCILE PANEL
// ============================================================

export async function reconcileSuggestionPanel(
    client
) {
    try {
        console.log(
            '[SuggestionPanel] Reconciling suggestion panel...'
        );

        // --------------------------------------------------------
        // FETCH CHANNEL
        // --------------------------------------------------------

        const channel =
            await client.channels.fetch(
                PUBLIC_CHANNEL_ID
            );

        if (!channel) {
            throw new Error(
                `Suggestion channel ${PUBLIC_CHANNEL_ID} could not be found.`
            );
        }

        if (!channel.isTextBased()) {
            throw new Error(
                `Suggestion channel ${PUBLIC_CHANNEL_ID} is not text-based.`
            );
        }

        // --------------------------------------------------------
        // HASH + STATE
        // --------------------------------------------------------

        const currentHash =
            getPanelHash();

        const state =
            loadState();

        // --------------------------------------------------------
        // EXISTING SAVED PANEL
        // --------------------------------------------------------

        if (
            state?.messageId &&
            state?.hash
        ) {
            const existingPanel =
                await findPanelById(
                    channel,
                    state.messageId
                );

            // ----------------------------------------------------
            // NOTHING CHANGED
            // ----------------------------------------------------

            if (
                existingPanel &&
                state.hash === currentHash
            ) {
                console.log(
                    `[SuggestionPanel] Panel unchanged: ${existingPanel.id}`
                );

                return {
                    action: 'unchanged',
                    messageId:
                        existingPanel.id,
                    channelId:
                        channel.id,
                };
            }

            // ----------------------------------------------------
            // PANEL CODE CHANGED
            // ----------------------------------------------------

            if (
                state.hash !==
                currentHash
            ) {
                console.log(
                    '[SuggestionPanel] Panel changed. Creating new panel...'
                );

                const newPanel =
                    await channel.send(
                        buildSuggestionPanel()
                    );

                console.log(
                    `[SuggestionPanel] New panel created: ${newPanel.id}`
                );

                // ------------------------------------------------
                // DELETE OLD PANEL ONLY AFTER NEW ONE WORKS
                // ------------------------------------------------

                if (existingPanel) {
                    try {
                        await existingPanel.delete(
                            'Suggestion panel updated'
                        );

                        console.log(
                            `[SuggestionPanel] Old panel deleted: ${existingPanel.id}`
                        );
                    } catch (error) {
                        console.warn(
                            '[SuggestionPanel] Could not delete old panel:',
                            getErrorMessage(error)
                        );
                    }
                }

                saveState({
                    messageId:
                        newPanel.id,
                    hash:
                        currentHash,
                });

                return {
                    action: 'replaced',
                    oldMessageId:
                        existingPanel?.id ??
                        null,
                    messageId:
                        newPanel.id,
                    channelId:
                        channel.id,
                };
            }

            // ----------------------------------------------------
            // STATE EXISTS BUT PANEL WAS DELETED
            // ----------------------------------------------------

            console.log(
                '[SuggestionPanel] Saved panel no longer exists. Creating replacement...'
            );

            const newPanel =
                await channel.send(
                    buildSuggestionPanel()
                );

            saveState({
                messageId:
                    newPanel.id,
                hash:
                    currentHash,
            });

            return {
                action: 'created',
                messageId:
                    newPanel.id,
                channelId:
                    channel.id,
            };
        }

        // --------------------------------------------------------
        // FIRST RUN / MIGRATION
        // --------------------------------------------------------

        console.log(
            '[SuggestionPanel] No saved panel state. Searching for existing panel...'
        );

        const existingPanel =
            await findExistingSuggestionPanel(
                channel,
                client
            );

        // --------------------------------------------------------
        // EXISTING PANEL FOUND
        // --------------------------------------------------------

        if (existingPanel) {
            console.log(
                `[SuggestionPanel] Existing panel found: ${existingPanel.id}`
            );

            saveState({
                messageId:
                    existingPanel.id,
                hash:
                    currentHash,
            });

            return {
                action: 'unchanged',
                messageId:
                    existingPanel.id,
                channelId:
                    channel.id,
            };
        }

        // --------------------------------------------------------
        // NO PANEL EXISTS
        // --------------------------------------------------------

        console.log(
            '[SuggestionPanel] No existing panel found. Creating one...'
        );

        const newPanel =
            await channel.send(
                buildSuggestionPanel()
            );

        saveState({
            messageId:
                newPanel.id,
            hash:
                currentHash,
        });

        console.log(
            `[SuggestionPanel] Panel created: ${newPanel.id}`
        );

        return {
            action: 'created',
            messageId:
                newPanel.id,
            channelId:
                channel.id,
        };
    } catch (error) {
        const errorMessage =
            getErrorMessage(error);

        console.error(
            '[SuggestionPanel] ERROR:',
            errorMessage
        );

        return {
            action: 'error',
            messageId: null,
            channelId:
                PUBLIC_CHANNEL_ID,
            error:
                errorMessage,
        };
    }
}
