// src/tickets/merchTickets.js

import crypto from 'node:crypto';

import {
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
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
| DATABASE STORAGE
|--------------------------------------------------------------------------
*/

const MERCH_PANEL_STORAGE_KEY =
  'fruity:ticket-panels:merch';

/*
|--------------------------------------------------------------------------
| BUILD MERCH TICKET PANEL
|--------------------------------------------------------------------------
*/

export function buildMerchTicketPanel() {
  const container = new ContainerBuilder();

  /*
  |--------------------------------------------------------------------------
  | TITLE + DESCRIPTION
  |--------------------------------------------------------------------------
  */

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## ${MERCH_TICKET_CONFIG.title}\n${MERCH_TICKET_CONFIG.description}`
    )
  );

  /*
  |--------------------------------------------------------------------------
  | TOP DIVIDER
  |--------------------------------------------------------------------------
  */

  container.addSeparatorComponents(
    new SeparatorBuilder()
  );

  /*
  |--------------------------------------------------------------------------
  | TICKET OPTIONS
  |--------------------------------------------------------------------------
  */

  for (
    let i = 0;
    i < MERCH_TICKET_CONFIG.buttons.length;
    i++
  ) {
    const button =
      MERCH_TICKET_CONFIG.buttons[i];

    const ticketButton =
      new ButtonBuilder()
        .setCustomId(
          `create_ticket:merch:${button.key}`
        )
        .setLabel(button.label)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(button.emoji);

    const section =
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `### ${button.emoji} ${button.label}\n${button.description}`
          )
        )
        .setButtonAccessory(ticketButton);

    container.addSectionComponents(section);

    /*
    |--------------------------------------------------------------------------
    | LARGE SPACING BETWEEN OPTIONS
    |--------------------------------------------------------------------------
    */

    if (
      i <
      MERCH_TICKET_CONFIG.buttons.length - 1
    ) {
      container.addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(
            SeparatorSpacingSize.Large
          )
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | DIVIDER BEFORE IMAGE
  |--------------------------------------------------------------------------
  */

  container.addSeparatorComponents(
    new SeparatorBuilder()
  );

  /*
  |--------------------------------------------------------------------------
  | BANNER IMAGE
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
  | DIVIDER BEFORE FOOTER
  |--------------------------------------------------------------------------
  */

  container.addSeparatorComponents(
    new SeparatorBuilder()
  );

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
| PANEL CONFIG HASH
|--------------------------------------------------------------------------
*/

function getMerchPanelHash() {
  const panelDefinition = {
    key: MERCH_TICKET_CONFIG.key,
    title: MERCH_TICKET_CONFIG.title,
    description:
      MERCH_TICKET_CONFIG.description,
    image: MERCH_TICKET_CONFIG.image,
    footer: MERCH_TICKET_CONFIG.footer,
    teamText:
      MERCH_TICKET_CONFIG.teamText,

    buttons:
      MERCH_TICKET_CONFIG.buttons.map(
        (button) => ({
          key: button.key,
          label: button.label,
          description:
            button.description,
          emoji: button.emoji,
        })
      ),
  };

  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify(panelDefinition)
    )
    .digest('hex');
}

/*
|--------------------------------------------------------------------------
| DATABASE HELPERS
|--------------------------------------------------------------------------
*/

async function getMerchPanelStorage(
  client
) {
  try {
    if (
      !client?.db ||
      typeof client.db.get !== 'function'
    ) {
      return null;
    }

    const stored =
      await client.db.get(
        MERCH_PANEL_STORAGE_KEY,
        null
      );

    if (
      !stored ||
      typeof stored !== 'object'
    ) {
      return null;
    }

    return stored;
  } catch {
    return null;
  }
}

async function saveMerchPanelStorage(
  client,
  data
) {
  try {
    if (
      !client?.db ||
      typeof client.db.set !== 'function'
    ) {
      return false;
    }

    await client.db.set(
      MERCH_PANEL_STORAGE_KEY,
      data
    );

    return true;
  } catch {
    return false;
  }
}

/*
|--------------------------------------------------------------------------
| FIND EXISTING MERCH PANEL
|--------------------------------------------------------------------------
*/

async function findExistingMerchPanel(
  channel,
  client
) {
  try {
    const messages =
      await channel.messages.fetch({
        limit: 100,
      });

    return (
      messages.find((message) => {
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

        const json =
          JSON.stringify(
            message.components.map(
              (component) =>
                typeof component?.toJSON ===
                'function'
                  ? component.toJSON()
                  : component
            )
          );

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
| GET STORED MERCH PANEL MESSAGE
|--------------------------------------------------------------------------
*/

async function getStoredMerchPanelMessage(
  client,
  channel
) {
  const storage =
    await getMerchPanelStorage(client);

  if (!storage?.messageId) {
    return null;
  }

  const message =
    await channel.messages
      .fetch(storage.messageId)
      .catch(() => null);

  if (!message) {
    return null;
  }

  if (
    message.author?.id !==
    client.user.id
  ) {
    return null;
  }

  if (!message.components?.length) {
    return null;
  }

  const json =
    JSON.stringify(
      message.components.map(
        (component) =>
          typeof component?.toJSON ===
          'function'
            ? component.toJSON()
            : component
      )
    );

  if (
    !json.includes(
      'create_ticket:merch:'
    )
  ) {
    return null;
  }

  return {
    message,
    storage,
  };
}

/*
|--------------------------------------------------------------------------
| RECONCILE MERCH PANEL
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

  const panelHash =
    getMerchPanelHash();

  const payload = {
    components,
    flags: MessageFlags.IsComponentsV2,
  };

  /*
  |--------------------------------------------------------------------------
  | STEP 1 — Try persisted message ID
  |--------------------------------------------------------------------------
  */

  const storedResult =
    await getStoredMerchPanelMessage(
      client,
      channel
    );

  if (storedResult) {
    const {
      message,
      storage,
    } = storedResult;

    /*
    |--------------------------------------------------------------------------
    | SAME CONFIG = DO ABSOLUTELY NOTHING
    |--------------------------------------------------------------------------
    */

    if (
      storage.configHash ===
      panelHash
    ) {
      return {
        created: false,
        changed: false,
        replaced: false,
        edited: false,
        messageId: message.id,
      };
    }

    /*
    |--------------------------------------------------------------------------
    | CONFIG CHANGED = EDIT EXISTING MESSAGE
    |--------------------------------------------------------------------------
    */

    await message.edit(payload);

    await saveMerchPanelStorage(
      client,
      {
        messageId: message.id,
        channelId:
          MERCH_TICKET_CONFIG.channelId,
        configHash: panelHash,
        updatedAt:
          new Date().toISOString(),
      }
    );

    return {
      created: false,
      changed: true,
      replaced: false,
      edited: true,
      messageId: message.id,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | STEP 2 — SEARCH FOR AN EXISTING PANEL
  |--------------------------------------------------------------------------
  */

  const existing =
    await findExistingMerchPanel(
      channel,
      client
    );

  if (existing) {
    /*
    |--------------------------------------------------------------------------
    | RECOVER EXISTING PANEL
    |--------------------------------------------------------------------------
    */

    await saveMerchPanelStorage(
      client,
      {
        messageId: existing.id,
        channelId:
          MERCH_TICKET_CONFIG.channelId,
        configHash: panelHash,
        recoveredAt:
          new Date().toISOString(),
      }
    );

    return {
      created: false,
      changed: false,
      replaced: false,
      edited: false,
      recovered: true,
      messageId: existing.id,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | STEP 3 — NO PANEL EXISTS
  |--------------------------------------------------------------------------
  */

  const message =
    await channel.send(payload);

  await saveMerchPanelStorage(
    client,
    {
      messageId: message.id,
      channelId:
        MERCH_TICKET_CONFIG.channelId,
      configHash: panelHash,
      createdAt:
        new Date().toISOString(),
    }
  );

  return {
    created: true,
    changed: true,
    replaced: false,
    edited: false,
    recovered: false,
    messageId: message.id,
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
