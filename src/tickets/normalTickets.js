// src/tickets/normalTickets.js

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
| NORMAL TICKET CONFIG
|--------------------------------------------------------------------------
*/

export const NORMAL_TICKET_CONFIG = {
  key: 'normal',

  channelId: '1541551721908801576',
  categoryId: '1542428718826524723',
  staffRoleId: '1541554350797619230',

  ticketLogsChannelId: '1542845775988391937',
  transcriptLogsChannelId: '1542845853310390342',
  reviewLogsChannelId: '1542859014499467285',

  image:
    'https://cdn.discordapp.com/attachments/1380169626171871282/1546404725870563368/5.jpg',

  footer:
    'Any abuse will result in a ban!',

  buttons: [
    {
      key: 'fruity_application',
      label: 'Fruity Application',
      description: 'Apply to join Fruity LLC.',
      emoji: {
        id: '1546395023413878836',
        name: 'Applications',
        animated: false,
      },
      createsTicket: true,
    },

    {
      key: 'general_faq',
      label: 'General FAQ',
      description: 'Ask a general question about Fruity.',
      emoji: {
        id: '1546395162136154122',
        name: 'Questions',
        animated: false,
      },
      createsTicket: true,
    },

    {
      key: 'staff_applications',
      label: 'Staff Applications',
      description: 'Apply for a staff position.',
      emoji: {
        id: '1546395107547156563',
        name: 'Briefcase',
        animated: true,
      },
      createsTicket: false,
    },
  ],
};

/*
|--------------------------------------------------------------------------
| DATABASE STORAGE
|--------------------------------------------------------------------------
*/

const NORMAL_PANEL_STORAGE_KEY =
  'fruity:ticket-panels:normal';

/*
|--------------------------------------------------------------------------
| BUILD NORMAL PANEL
|--------------------------------------------------------------------------
*/

export function buildNormalTicketPanel() {
  const container = new ContainerBuilder()
    .setAccentColor(BRAND_COLOR);

  /*
  |--------------------------------------------------------------------------
  | FRUITY APPLICATION
  |--------------------------------------------------------------------------
  */

  const application =
    NORMAL_TICKET_CONFIG.buttons.find(
      (button) => button.key === 'fruity_application'
    );

  const applicationButton =
    new ButtonBuilder()
      .setCustomId(
        'create_ticket:normal:fruity_application'
      )
      .setLabel(application.label)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(application.emoji);

  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `### ${application.emoji} ${application.label}\n${application.description}`
        )
      )
      .setButtonAccessory(applicationButton)
  );

  /*
  |--------------------------------------------------------------------------
  | LARGE DIVIDER
  |--------------------------------------------------------------------------
  */

  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setSpacing(SeparatorSpacingSize.Large)
  );

  /*
  |--------------------------------------------------------------------------
  | GENERAL FAQ
  |--------------------------------------------------------------------------
  */

  const faq =
    NORMAL_TICKET_CONFIG.buttons.find(
      (button) => button.key === 'general_faq'
    );

  const faqButton =
    new ButtonBuilder()
      .setCustomId(
        'create_ticket:normal:general_faq'
      )
      .setLabel(faq.label)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(faq.emoji);

  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `### ${faq.emoji} ${faq.label}\n${faq.description}`
        )
      )
      .setButtonAccessory(faqButton)
  );

  /*
  |--------------------------------------------------------------------------
  | LARGE DIVIDER
  |--------------------------------------------------------------------------
  */

  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setSpacing(SeparatorSpacingSize.Large)
  );

  /*
  |--------------------------------------------------------------------------
  | STAFF APPLICATIONS
  |--------------------------------------------------------------------------
  |
  | NO TICKET BUTTON.
  |
  */

  const staff =
    NORMAL_TICKET_CONFIG.buttons.find(
      (button) => button.key === 'staff_applications'
    );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### ${staff.emoji} ${staff.label}\n${staff.description}\n\n**Use \`/applications\` to apply for a staff position.**`
    )
  );

  /*
  |--------------------------------------------------------------------------
  | LARGE DIVIDER
  |--------------------------------------------------------------------------
  */

  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setSpacing(SeparatorSpacingSize.Large)
  );

  /*
  |--------------------------------------------------------------------------
  | IMAGE
  |--------------------------------------------------------------------------
  */

  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder()
        .setURL(NORMAL_TICKET_CONFIG.image)
    )
  );

  /*
  |--------------------------------------------------------------------------
  | FOOTER DIVIDER
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
      NORMAL_TICKET_CONFIG.footer
    )
  );

  return container;
}

/*
|--------------------------------------------------------------------------
| PANEL HASH
|--------------------------------------------------------------------------
*/

function getNormalPanelHash() {
  const panelDefinition = {
    version: 3,
    key: NORMAL_TICKET_CONFIG.key,
    image: NORMAL_TICKET_CONFIG.image,
    footer: NORMAL_TICKET_CONFIG.footer,

    buttons:
      NORMAL_TICKET_CONFIG.buttons.map(
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

async function getNormalPanelStorage(client) {
  try {
    if (
      !client?.db ||
      typeof client.db.get !== 'function'
    ) {
      return null;
    }

    const stored =
      await client.db.get(
        NORMAL_PANEL_STORAGE_KEY,
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
      '[Normal Tickets] Failed to read panel storage:',
      error
    );

    return null;
  }
}

async function saveNormalPanelStorage(
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
      NORMAL_PANEL_STORAGE_KEY,
      data
    );

    return true;
  } catch (error) {
    console.error(
      '[Normal Tickets] Failed to save panel storage:',
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

function isNormalTicketPanel(
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
      'create_ticket:normal:'
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

async function findExistingNormalPanel(
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
          isNormalTicketPanel(
            message,
            client
          )
      ) || null
    );
  } catch (error) {
    console.error(
      '[Normal Tickets] Failed to search for existing panel:',
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

async function getStoredNormalPanelMessage(
  client,
  channel
) {
  const storage =
    await getNormalPanelStorage(client);

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
    !isNormalTicketPanel(
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

export async function reconcileNormalTicketPanel(
  client
) {
  if (!client) {
    throw new Error(
      '[Normal Tickets] Discord client was not provided.'
    );
  }

  if (!client.user) {
    throw new Error(
      '[Normal Tickets] Discord client is not ready yet.'
    );
  }

  const channel =
    await client.channels
      .fetch(
        NORMAL_TICKET_CONFIG.channelId
      )
      .catch((error) => {
        console.error(
          '[Normal Tickets] Failed to fetch panel channel:',
          error
        );

        return null;
      });

  if (!channel) {
    throw new Error(
      `Normal ticket panel channel ${NORMAL_TICKET_CONFIG.channelId} was not found.`
    );
  }

  if (!channel.isTextBased()) {
    throw new Error(
      `Normal ticket panel channel ${NORMAL_TICKET_CONFIG.channelId} is not a text channel.`
    );
  }

  const container =
    buildNormalTicketPanel();

  const panelHash =
    getNormalPanelHash();

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
    await getStoredNormalPanelMessage(
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
        `[Normal Tickets] Panel is already up to date (${message.id}).`
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
        '[Normal Tickets] Failed to edit panel:',
        error
      );

      throw new Error(
        `Failed to edit the Normal ticket panel: ${
          error?.message || error
        }`
      );
    }

    await saveNormalPanelStorage(
      client,
      {
        messageId: message.id,
        channelId:
          NORMAL_TICKET_CONFIG.channelId,
        configHash: panelHash,
        updatedAt:
          new Date().toISOString(),
      }
    );

    console.log(
      `[Normal Tickets] Panel updated (${message.id}).`
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
    await findExistingNormalPanel(
      channel,
      client
    );

  if (existing) {
    await saveNormalPanelStorage(
      client,
      {
        messageId: existing.id,
        channelId:
          NORMAL_TICKET_CONFIG.channelId,
        configHash: panelHash,
        recoveredAt:
          new Date().toISOString(),
      }
    );

    console.log(
      `[Normal Tickets] Recovered existing panel (${existing.id}).`
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
      '[Normal Tickets] PANEL SEND FAILED:',
      error
    );

    throw new Error(
      `Failed to send the Normal ticket panel: ${
        error?.message || error
      }`
    );
  }

  await saveNormalPanelStorage(
    client,
    {
      messageId: message.id,
      channelId:
        NORMAL_TICKET_CONFIG.channelId,
      configHash: panelHash,
      createdAt:
        new Date().toISOString(),
    }
  );

  console.log(
    `[Normal Tickets] Panel created successfully (${message.id}).`
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

export function getNormalTicketType(
  ticketTypeKey
) {
  return (
    NORMAL_TICKET_CONFIG.buttons.find(
      (button) =>
        button.key === ticketTypeKey
    ) || null
  );
}

export const NORMAL_TICKET_BRAND_COLOR =
  BRAND_COLOR;
