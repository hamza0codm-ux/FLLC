// src/tickets/merchTickets.js

import {
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
} from 'discord.js';

const BRAND_COLOR = 0xF8D568;

/*
|--------------------------------------------------------------------------
| MERCH TICKET PANEL CONFIG
|--------------------------------------------------------------------------
*/

export const MERCH_TICKET_CONFIG = {
  key: 'merch',

  channelId: '1543031129559408660',

  categoryId: '1543352648021966949',

  staffRoleId: '1543556139462164480',

  ticketLogsChannelId: '1543331796568121467',

  transcriptLogsChannelId: '1543331916235931678',

  reviewLogsChannelId: '1543332129117708380',

  title: '🛍️ Merch Tickets',

  description:
    'Need help with Fruity merchandise? Select the option below that best matches your request.',

  image:
    'https://media.discordapp.net/attachments/1380169626171871282/1546404726193651803/6.jpg?ex=6a9fa921&is=6a9e57a1&hm=c9551eab504e942186cabd5af382283763b2753152fbdc36c7933489687cf0fb&=&format=webp&width=2048&height=682',

  footer:
    '🛍️ Select the button that best matches your request to open a Fruity merchandise support ticket.',

  teamText:
    'The Fruity Customer Service Team will assist you shortly,',

  buttons: [
    {
      key: 'returns',
      label: 'Returns',
      description:
        'Need help with returning an item?',
      emoji:
        '<a:No:1545795160586190858>',
    },

    {
      key: 'inquire',
      label: 'Inquire',
      description:
        'Have a question about Fruity merchandise?',
      emoji:
        '<:Questions:1546395162136154122>',
    },

    {
      key: 'shipping_help',
      label: 'Shipping help',
      description:
        'Need help with shipping or delivery?',
      emoji:
        '<a:Package:1546271416436006942>',
    },
  ],
};

/*
|--------------------------------------------------------------------------
| BUILD MERCH TICKET PANEL
|--------------------------------------------------------------------------
*/

export function buildMerchTicketPanel() {
  const container = new ContainerBuilder();

  /*
  |--------------------------------------------------------------------------
  | TITLE
  |--------------------------------------------------------------------------
  */

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## ${MERCH_TICKET_CONFIG.title}\n${MERCH_TICKET_CONFIG.description}`
    )
  );

  /*
  |--------------------------------------------------------------------------
  | TOP SEPARATOR
  |--------------------------------------------------------------------------
  */

  container.addSeparatorComponents(
    new SeparatorBuilder()
  );

  /*
  |--------------------------------------------------------------------------
  | BANNER
  |--------------------------------------------------------------------------
  */

  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL(
        MERCH_TICKET_CONFIG.image
      )
    )
  );

  /*
  |--------------------------------------------------------------------------
  | SEPARATOR
  |--------------------------------------------------------------------------
  */

  container.addSeparatorComponents(
    new SeparatorBuilder()
  );

  /*
  |--------------------------------------------------------------------------
  | MERCH OPTIONS
  |--------------------------------------------------------------------------
  */

  for (const button of MERCH_TICKET_CONFIG.buttons) {
    const ticketButton = new ButtonBuilder()
      .setCustomId(
        `create_ticket:merch:${button.key}`
      )
      .setLabel(button.label)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(button.emoji);

    const section = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `### ${button.emoji} ${button.label}\n${button.description}`
        )
      )
      .setButtonAccessory(ticketButton);

    container.addSectionComponents(section);

    container.addSeparatorComponents(
      new SeparatorBuilder()
    );
  }

  /*
  |--------------------------------------------------------------------------
  | FOOTER
  |--------------------------------------------------------------------------
  */

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      MERCH_TICKET_CONFIG.footer
    )
  );

  return [container];
}

/*
|--------------------------------------------------------------------------
| NORMALIZE COMPONENTS
|--------------------------------------------------------------------------
*/

function normalizeComponent(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeComponent);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const normalized = {};

  for (const [key, item] of Object.entries(value)) {
    if (key === 'id') {
      continue;
    }

    normalized[key] =
      normalizeComponent(item);
  }

  return normalized;
}

/*
|--------------------------------------------------------------------------
| GET PANEL STRUCTURE
|--------------------------------------------------------------------------
*/

function getMerchPanelStructure(
  messageOrComponents
) {
  const components = Array.isArray(
    messageOrComponents
  )
    ? messageOrComponents
    : messageOrComponents?.components || [];

  return normalizeComponent(
    components.map((component) => {
      if (
        typeof component?.toJSON ===
        'function'
      ) {
        return component.toJSON();
      }

      return component;
    })
  );
}

/*
|--------------------------------------------------------------------------
| CHECK FOR CHANGES
|--------------------------------------------------------------------------
*/

function merchPanelChanged(
  existingMessage,
  newComponents
) {
  const existingStructure =
    getMerchPanelStructure(
      existingMessage.components
    );

  const newStructure =
    getMerchPanelStructure(
      newComponents
    );

  return (
    JSON.stringify(existingStructure) !==
    JSON.stringify(newStructure)
  );
}

/*
|--------------------------------------------------------------------------
| FIND EXISTING MERCH PANEL
|--------------------------------------------------------------------------
*/

async function findMerchPanelMessage(channel) {
  try {
    const messages =
      await channel.messages.fetch({
        limit: 50,
      });

    return (
      messages.find((message) => {
        if (
          message.author?.id !==
          channel.client.user.id
        ) {
          return false;
        }

        if (!message.components?.length) {
          return false;
        }

        const structure =
          getMerchPanelStructure(
            message.components
          );

        const json =
          JSON.stringify(structure);

        return json.includes(
          'create_ticket:merch:'
        );
      }) || null
    );
  } catch {
    return null;
  }
}

/*
|--------------------------------------------------------------------------
| CREATE / REPLACE MERCH PANEL
|--------------------------------------------------------------------------
*/

export async function reconcileMerchTicketPanel(
  client
) {
  const channel =
    await client.channels
      .fetch(
        MERCH_TICKET_CONFIG.channelId
      )
      .catch(() => null);

  if (!channel?.isTextBased()) {
    throw new Error(
      `Merch ticket panel channel ${MERCH_TICKET_CONFIG.channelId} was not found.`
    );
  }

  const components =
    buildMerchTicketPanel();

  const payload = {
    components,
    flags: MessageFlags.IsComponentsV2,
  };

  const existing =
    await findMerchPanelMessage(channel);

  /*
  |--------------------------------------------------------------------------
  | NO PANEL EXISTS
  |--------------------------------------------------------------------------
  */

  if (!existing) {
    const message =
      await channel.send(payload);

    return {
      created: true,
      changed: true,
      messageId: message.id,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | NOTHING CHANGED
  |--------------------------------------------------------------------------
  */

  if (
    !merchPanelChanged(
      existing,
      components
    )
  ) {
    return {
      created: false,
      changed: false,
      messageId: existing.id,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | CONFIG CHANGED
  |--------------------------------------------------------------------------
  |
  | Send a completely NEW message.
  |
  */

  const newMessage =
    await channel.send(payload);

  /*
  |--------------------------------------------------------------------------
  | DELETE OLD MESSAGE
  |--------------------------------------------------------------------------
  */

  await existing
    .delete()
    .catch(() => null);

  return {
    created: true,
    changed: true,
    replaced: true,
    oldMessageId: existing.id,
    messageId: newMessage.id,
  };
}

/*
|--------------------------------------------------------------------------
| GET MERCH TICKET TYPE
|--------------------------------------------------------------------------
*/

export function getMerchTicketType(
  ticketTypeKey
) {
  return (
    MERCH_TICKET_CONFIG.buttons.find(
      (button) =>
        button.key === ticketTypeKey
    ) || null
  );
}

export const MERCH_TICKET_BRAND_COLOR =
  BRAND_COLOR;
