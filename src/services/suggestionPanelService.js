// src/services/suggestionPanelService.js

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

const PUBLIC_CHANNEL_ID = '1545071209429999736';

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

async function findExistingSuggestionPanel(channel, client) {
  const messages = await channel.messages.fetch({ limit: 100 });

  return (
    messages.find(message => {
      if (message.author?.id !== client.user.id) {
        return false;
      }

      if (!message.components?.length) {
        return false;
      }

      return message.components.some(row =>
        row.components?.some(
          component =>
            component.customId === 'suggestion:submit' ||
            component.customId === 'suggestion:status'
        )
      );
    }) || null
  );
}

/**
 * Removes Discord-generated / irrelevant fields that can differ
 * between fetched messages and newly-built components.
 */
function normalize(value) {
  if (value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(normalize);
  }

  if (value && typeof value === 'object') {
    const result = {};

    for (const [key, val] of Object.entries(value)) {
      // Discord can return these fields on fetched components.
      if (
        key === 'id' ||
        key === 'application_id' ||
        key === 'author' ||
        key === 'timestamp' ||
        key === 'edited_timestamp'
      ) {
        continue;
      }

      result[key] = normalize(val);
    }

    return result;
  }

  return value;
}

function panelsAreEqual(message, desiredPanel) {
  const existingEmbeds = message.embeds.map(embed =>
    normalize(embed.toJSON())
  );

  const desiredEmbeds = desiredPanel.embeds.map(embed =>
    normalize(embed.toJSON())
  );

  const existingComponents = message.components.map(row =>
    normalize(row.toJSON())
  );

  const desiredComponents = desiredPanel.components.map(row =>
    normalize(row.toJSON())
  );

  return (
    JSON.stringify(existingEmbeds) === JSON.stringify(desiredEmbeds) &&
    JSON.stringify(existingComponents) === JSON.stringify(desiredComponents)
  );
}

export async function reconcileSuggestionPanel(client) {
  try {
    const channel = await client.channels.fetch(PUBLIC_CHANNEL_ID);

    if (!channel || !channel.isTextBased()) {
      throw new Error(
        `Suggestion channel ${PUBLIC_CHANNEL_ID} could not be found or is not text based.`
      );
    }

    const panel = buildSuggestionPanel();

    const existingPanel = await findExistingSuggestionPanel(
      channel,
      client
    );

    // No panel exists, so create it.
    if (!existingPanel) {
      const newPanel = await channel.send(panel);

      return {
        action: 'created',
        messageId: newPanel.id,
        channelId: channel.id,
      };
    }

    // Panel exists and is already identical.
    if (panelsAreEqual(existingPanel, panel)) {
      return {
        action: 'unchanged',
        messageId: existingPanel.id,
        channelId: channel.id,
      };
    }

    // Panel exists but the code/content has changed.
    await existingPanel.edit(panel);

    return {
      action: 'updated',
      messageId: existingPanel.id,
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
