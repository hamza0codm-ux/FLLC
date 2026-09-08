// src/services/suggestionPanelService.js

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

const PUBLIC_CHANNEL_ID =
  '1545071209429999736';

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


/*
|--------------------------------------------------------------------------
| Build Suggestion Panel
|--------------------------------------------------------------------------
*/

function buildSuggestionPanel() {
  const embed =
    new EmbedBuilder()
      .setColor('#F8D568')
      .setTitle(
        'Have your ideas heard at Fruity'
      )
      .setDescription(
        'Have an idea, improvement, or suggestion for Fruity?\n' +
        'We want to hear what you think.\n' +
        'Submit your idea below and our Management team will review it.'
      )
      .setImage(
        PANEL_IMAGE
      );

  const buttons =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            'suggestion:submit'
          )
          .setStyle(
            ButtonStyle.Secondary
          )
          .setEmoji(
            SUGGESTION_EMOJI
          )
          .setLabel(
            'Submit'
          ),

        new ButtonBuilder()
          .setCustomId(
            'suggestion:status'
          )
          .setStyle(
            ButtonStyle.Secondary
          )
          .setEmoji(
            LOADING_EMOJI
          )
          .setLabel(
            'My status'
          )
      );

  return {
    embeds: [
      embed,
    ],

    components: [
      buttons,
    ],
  };
}


/*
|--------------------------------------------------------------------------
| Find Existing Suggestion Panel
|--------------------------------------------------------------------------
*/

async function findExistingSuggestionPanel(
  channel,
  client
) {
  const messages =
    await channel.messages.fetch({
      limit: 100,
    });

  return (
    messages.find(
      message => {
        if (
          message.author?.id !==
          client.user.id
        ) {
          return false;
        }

        if (
          !message.components?.length
        ) {
          return false;
        }

        return message.components.some(
          row =>
            row.components?.some(
              component =>
                component.customId ===
                  'suggestion:submit' ||
                component.customId ===
                  'suggestion:status'
            )
        );
      }
    ) ||
    null
  );
}


/*
|--------------------------------------------------------------------------
| Reconcile Suggestion Panel
|--------------------------------------------------------------------------
*/

export async function reconcileSuggestionPanel(
  client
) {
  try {
    const channel =
      await client.channels.fetch(
        PUBLIC_CHANNEL_ID
      );

    if (
      !channel ||
      !channel.isTextBased()
    ) {
      throw new Error(
        `Suggestion channel ${PUBLIC_CHANNEL_ID} could not be found or is not text-based.`
      );
    }

    const panel =
      buildSuggestionPanel();

    const existingPanel =
      await findExistingSuggestionPanel(
        channel,
        client
      );

    /*
    |--------------------------------------------------------------------------
    | Existing panel found
    |--------------------------------------------------------------------------
    */

    if (
      existingPanel
    ) {
      await existingPanel.edit(
        panel
      );

      return {
        action:
          'updated',

        messageId:
          existingPanel.id,

        channelId:
          channel.id,
      };
    }


    /*
    |--------------------------------------------------------------------------
    | No panel found — create one
    |--------------------------------------------------------------------------
    */

    const newPanel =
      await channel.send(
        panel
      );

    return {
      action:
        'created',

      messageId:
        newPanel.id,

      channelId:
        channel.id,
    };

  } catch (error) {
    return {
      action:
        'error',

      messageId:
        null,

      channelId:
        PUBLIC_CHANNEL_ID,

      error:
        error.message,
    };
  }
}
