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
| MERCH TICKET CONFIG
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

  image:
    'https://cdn.discordapp.com/attachments/1380169626171871282/1546404726193651803/6.jpg',

  footer:
    'Any abuse will result in a ban!',

  buttons: [
    {
      key: 'returns',
      label: 'Returns',
      description:
        'Need help with returning an item?',
      emoji:
        '<a:No:1545795160586190858>',
      createsTicket: true,
    },

    {
      key: 'inquire',
      label: 'Inquire',
      description:
        'Have a question about Fruity merchandise?',
      emoji:
        '<:Questions:1546395162136154122>',
      createsTicket: true,
    },

    {
      key: 'shipping_help',
      label: 'Shipping help',
      description:
        'Need help with shipping or delivery?',
      emoji:
        '<a:Package:1546271416436006942>',
      createsTicket: true,
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
| BUILD MERCH PANEL
|--------------------------------------------------------------------------
*/

export function buildMerchTicketPanel() {
  const container = new ContainerBuilder()
    .setAccentColor(BRAND_COLOR);

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
  | IMAGE
  |--------------------------------------------------------------------------
  */

  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setSpacing(SeparatorSpacingSize.Large)
  );

  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder()
        .setURL(
          MERCH_TICKET_CONFIG.image
        )
    )
  );

  /*
  |--------------------------------------------------------------------------
  | FOOTER
  |--------------------------------------------------------------------------
  */

  container.addSeparatorComponents(
    new SeparatorBuilder()
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      MERCH_TICKET_CONFIG.footer
    )
  );

  return container;
}

/*
|--------------------------------------------------------------------------
| PANEL HASH
|--------------------------------------------------------------------------
*/

function getMerchPanelHash() {
  const panelDefinition = {
    version: 3,
    key: MERCH_TICKET_CONFIG.key,
    image: MERCH_TICKET_CONFIG.image,
    footer: MERCH_TICKET_CONFIG.footer,

    buttons:
      MERCH_TICKET_CONFIG.buttons.map(
        (button) => ({
          key: button.key,
          label: button.label,
          description: button.description,
          emoji: button.emoji,
          createsTicket: button.createsTicket,
        })
      ),
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(panelDefinition))
    .digest('hex');
}

/*
|--------------------------------------------------------------------------
| DATABASE
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
  } catch (error) {
    console.error(
      '[Merch Tickets] Failed to read panel storage:',
      error
    );

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
  } catch (error) {
    console.error(
      '[Merch Tickets] Failed to save panel storage:',
      error
    );

    return false;
  }
}

/*
|--------------------------------------------------------------------------
| CHECK PANEL
|--------------------------------------------------------------------------
*/

function isMerchTicketPanel(
  message,
  client
) {
  try {
    if (!message) return false;

    if (
      message.author?.id !== client.user.id
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
            typeof component?.toJSON === 'function'
              ? component.toJSON()
              : component
        )
      );

    return json.includes(
      'create_ticket:merch:'
    );
  } catch {
    return false;
  }
}

/*
|--------------------------------------------------------------------------
| FIND EXISTING PANEL
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
      messages.find(
        (message) =>
          isMerchTicketPanel(
            message,
            client
          )
      ) || null
    );
  } catch (error) {
    console.error(
      '[Merch Tickets] Failed to search for existing panel:',
      error
    );

    return null;
  }
}

/*
|--------------------------------------------------------------------------
| STORED PANEL
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
    !isMerchTicketPanel(
      message,
      client
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
| RECONCILE PANEL
|--------------------------------------------------------------------------
*/

export async function reconcileMerchTicketPanel(
  client
) {
  if (!client) {
    throw new Error(
      '[Merch Tickets] Discord client was not provided.'
    );
  }

  if (!client.user) {
    throw new Error(
      '[Merch Tickets] Discord client is not ready yet.'
    );
  }

  const channel =
    await client.channels
      .fetch(
        MERCH_TICKET_CONFIG.channelId
      )
      .catch((error) => {
        console.error(
          '[Merch Tickets] Failed to fetch panel channel:',
          error
        );

        return null;
      });

  if (!channel) {
    throw new Error(
      `Merch ticket panel channel ${MERCH_TICKET_CONFIG.channelId} was not found.`
    );
  }

  if (!channel.isTextBased()) {
    throw new Error(
      `Merch ticket panel channel ${MERCH_TICKET_CONFIG.channelId} is not a text channel.`
    );
  }

  const container =
    buildMerchTicketPanel();

  const panelHash =
    getMerchPanelHash();

  const payload = {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };

  /*
  |--------------------------------------------------------------------------
  | STORED MESSAGE
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

    if (
      storage.configHash ===
      panelHash
    ) {
      console.log(
        `[Merch Tickets] Panel is already up to date (${message.id}).`
      );

      return {
        created: false,
        changed: false,
        replaced: false,
        edited: false,
        recovered: false,
        messageId: message.id,
      };
    }

    try {
      await message.edit(payload);
    } catch (error) {
      console.error(
        '[Merch Tickets] Failed to edit panel:',
        error
      );

      throw new Error(
        `Failed to edit the Merch ticket panel: ${
          error?.message || error
        }`
      );
    }

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

    console.log(
      `[Merch Tickets] Panel updated (${message.id}).`
    );

    return {
      created: false,
      changed: true,
      replaced: false,
      edited: true,
      recovered: false,
      messageId: message.id,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | SEARCH BEFORE CREATING
  |--------------------------------------------------------------------------
  */

  const existing =
    await findExistingMerchPanel(
      channel,
      client
    );

  if (existing) {
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

    console.log(
      `[Merch Tickets] Recovered existing panel (${existing.id}).`
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
  | CREATE
  |--------------------------------------------------------------------------
  */

  let message;

  try {
    message =
      await channel.send(payload);
  } catch (error) {
    console.error(
      '[Merch Tickets] PANEL SEND FAILED:',
      error
    );

    throw new Error(
      `Failed to send the Merch ticket panel: ${
        error?.message || error
      }`
    );
  }

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

  console.log(
    `[Merch Tickets] Panel created successfully (${message.id}).`
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
| GET TICKET TYPE
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
