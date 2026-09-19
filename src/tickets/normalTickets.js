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
| NORMAL TICKET PANEL CONFIG
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
    'Any abuse will result in a ban',

  buttons: [
    {
      key: 'fruity_application',

      label: 'Fruity Application',

      description:
        'Apply to join Fruity LLC.',

      emoji: {
        id: '1546395023413878836',
        name: 'Applications',
        animated: false,
      },

      // This option creates a ticket.
      createsTicket: true,
    },

    {
      key: 'general_faq',

      label: 'General FAQ',

      description:
        'Ask a general question about Fruity.',

      emoji: {
        id: '1546395162136154122',
        name: 'Questions',
        animated: false,
      },

      // This option creates a ticket.
      createsTicket: true,
    },

    {
      key: 'staff_applications',

      label: 'Staff Applications',

      description:
        'Apply for a staff position. **Use** **`/applications`** **to apply for a staff position.**',

      emoji: {
        id: '1546395107547156563',
        name: 'Briefcase',
        animated: true,
      },

      // IMPORTANT:
      // Staff applications do NOT create a ticket.
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
| EMOJI TEXT HELPER
|--------------------------------------------------------------------------
|
| Discord.js emoji configuration objects become "[object Object]" when
| directly inserted into a string.
|
| This converts:
|
| {
|   id: '123',
|   name: 'Applications',
|   animated: false
| }
|
| into:
|
| <:Applications:123>
|
| or for animated emojis:
|
| <a:Applications:123>
|
|--------------------------------------------------------------------------
*/

function emojiToText(emoji) {
  if (!emoji) {
    return '';
  }

  /*
  |--------------------------------------------------------------------------
  | Already formatted emoji string
  |--------------------------------------------------------------------------
  */

  if (typeof emoji === 'string') {
    return emoji;
  }

  /*
  |--------------------------------------------------------------------------
  | Discord emoji object
  |--------------------------------------------------------------------------
  */

  if (
    typeof emoji === 'object' &&
    emoji.id &&
    emoji.name
  ) {
    return `<${
      emoji.animated ? 'a' : ''
    }:${emoji.name}:${emoji.id}>`;
  }

  return '';
}

/*
|--------------------------------------------------------------------------
| BUILD NORMAL TICKET PANEL
|--------------------------------------------------------------------------
*/

export function buildNormalTicketPanel() {
  const container =
    new ContainerBuilder().setAccentColor(
      BRAND_COLOR
    );

  /*
  |--------------------------------------------------------------------------
  | TICKET OPTIONS
  |--------------------------------------------------------------------------
  */

  for (
    let i = 0;
    i < NORMAL_TICKET_CONFIG.buttons.length;
    i++
  ) {
    const button =
      NORMAL_TICKET_CONFIG.buttons[i];

    /*
    |--------------------------------------------------------------------------
    | CONVERT EMOJI OBJECT TO DISCORD TEXT
    |--------------------------------------------------------------------------
    */

    const emojiText =
      emojiToText(button.emoji);

    /*
    |--------------------------------------------------------------------------
    | BUILD SECTION TEXT
    |--------------------------------------------------------------------------
    |
    | IMPORTANT:
    | Never do:
    |
    | `${button.emoji} ${button.label}`
    |
    | because that produces "[object Object]".
    |
    */

    const sectionText =
      emojiText
        ? `### ${emojiText} ${button.label}\n${button.description}`
        : `### ${button.label}\n${button.description}`;

    /*
    |--------------------------------------------------------------------------
    | BUILD SECTION
    |--------------------------------------------------------------------------
    */

    const section =
      new SectionBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          sectionText
        )
      );

    /*
    |--------------------------------------------------------------------------
    | ONLY CREATE BUTTONS FOR TICKET OPTIONS
    |--------------------------------------------------------------------------
    |
    | Staff Applications intentionally has NO button.
    | Users are told to use /applications instead.
    |
    */

    if (button.createsTicket) {
      const ticketButton =
        new ButtonBuilder()
          .setCustomId(
            `create_ticket:normal:${button.key}`
          )
          .setLabel(button.label)
          .setStyle(
            ButtonStyle.Secondary
          );

      /*
      |--------------------------------------------------------------------------
      | SET BUTTON EMOJI
      |--------------------------------------------------------------------------
      */

      if (
        button.emoji &&
        button.emoji.id &&
        button.emoji.name
      ) {
        ticketButton.setEmoji({
          id: button.emoji.id,
          name: button.emoji.name,
          animated:
            Boolean(button.emoji.animated),
        });
      }

      section.setButtonAccessory(
        ticketButton
      );
    }

    /*
    |--------------------------------------------------------------------------
    | ADD SECTION
    |--------------------------------------------------------------------------
    */

    container.addSectionComponents(
      section
    );

    /*
    |--------------------------------------------------------------------------
    | LARGE DIVIDER BETWEEN OPTIONS
    |--------------------------------------------------------------------------
    */

    if (
      i <
      NORMAL_TICKET_CONFIG.buttons.length - 1
    ) {
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(
          SeparatorSpacingSize.Large
        )
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | IMAGE DIVIDER
  |--------------------------------------------------------------------------
  */

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(
      SeparatorSpacingSize.Large
    )
  );

  /*
  |--------------------------------------------------------------------------
  | IMAGE
  |--------------------------------------------------------------------------
  */

  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL(
        NORMAL_TICKET_CONFIG.image
      )
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
| PANEL CONFIG HASH
|--------------------------------------------------------------------------
*/

function getNormalPanelHash() {
  const panelDefinition = {
    version: 4,

    key:
      NORMAL_TICKET_CONFIG.key,

    image:
      NORMAL_TICKET_CONFIG.image,

    footer:
      NORMAL_TICKET_CONFIG.footer,

    buttons:
      NORMAL_TICKET_CONFIG.buttons.map(
        button => ({
          key: button.key,

          label: button.label,

          description:
            button.description,

          emoji: button.emoji,

          createsTicket:
            button.createsTicket,
        })
      ),
  };

  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify(
        panelDefinition
      )
    )
    .digest('hex');
}

/*
|--------------------------------------------------------------------------
| DATABASE HELPERS
|--------------------------------------------------------------------------
*/

async function getNormalPanelStorage(
  client
) {
  try {
    if (
      !client?.db ||
      typeof client.db.get !==
        'function'
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
      typeof client.db.set !==
        'function'
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
| CHECK IF MESSAGE IS NORMAL TICKET PANEL
|--------------------------------------------------------------------------
*/

function isNormalTicketPanel(
  message,
  client
) {
  try {
    if (!message) {
      return false;
    }

    if (
      message.author?.id !==
      client.user.id
    ) {
      return false;
    }

    if (
      !message.components ||
      !message.components.length
    ) {
      return false;
    }

    const json =
      JSON.stringify(
        message.components.map(
          component =>
            typeof component?.toJSON ===
            'function'
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
| FIND EXISTING NORMAL PANEL
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
        message =>
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
| GET STORED NORMAL PANEL MESSAGE
|--------------------------------------------------------------------------
*/

async function getStoredNormalPanelMessage(
  client,
  channel
) {
  const storage =
    await getNormalPanelStorage(
      client
    );

  if (!storage?.messageId) {
    return null;
  }

  const message =
    await channel.messages
      .fetch(
        storage.messageId
      )
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
| RECONCILE NORMAL PANEL
|--------------------------------------------------------------------------
|
| SAME CONFIG:
|   Do nothing.
|
| CONFIG CHANGED:
|   Edit the existing panel.
|
| STORED MESSAGE DELETED:
|   Search for an existing panel.
|
| NO PANEL:
|   Create exactly one panel.
|
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

  /*
  |--------------------------------------------------------------------------
  | GET CHANNEL
  |--------------------------------------------------------------------------
  */

  const channel =
    await client.channels
      .fetch(
        NORMAL_TICKET_CONFIG.channelId
      )
      .catch(error => {
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

  /*
  |--------------------------------------------------------------------------
  | BUILD PANEL
  |--------------------------------------------------------------------------
  */

  const container =
    buildNormalTicketPanel();

  const panelHash =
    getNormalPanelHash();

  /*
  |--------------------------------------------------------------------------
  | COMPONENTS V2 PAYLOAD
  |--------------------------------------------------------------------------
  */

  const payload = {
    components: [
      container,
    ],

    flags:
      MessageFlags.IsComponentsV2,
  };

  /*
  |--------------------------------------------------------------------------
  | CHECK STORED MESSAGE
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

    /*
    |--------------------------------------------------------------------------
    | NOTHING CHANGED
    |--------------------------------------------------------------------------
    */

    if (
      storage.configHash ===
      panelHash
    ) {
      console.log(
        `[Normal Tickets] Panel is already up to date (${message.id}).`
      );

      return {
        action: 'unchanged',

        created: false,
        changed: false,
        replaced: false,
        edited: false,
        recovered: false,

        messageId:
          message.id,
      };
    }

    /*
    |--------------------------------------------------------------------------
    | CONFIG CHANGED
    |--------------------------------------------------------------------------
    */

    try {
      await message.edit(
        payload
      );
    } catch (error) {
      console.error(
        '[Normal Tickets] Failed to edit existing panel:',
        error
      );

      throw new Error(
        `Failed to edit the Normal ticket panel: ${
          error?.message ||
          error
        }`
      );
    }

    await saveNormalPanelStorage(
      client,
      {
        messageId:
          message.id,

        channelId:
          NORMAL_TICKET_CONFIG.channelId,

        configHash:
          panelHash,

        updatedAt:
          new Date().toISOString(),
      }
    );

    console.log(
      `[Normal Tickets] Panel updated (${message.id}).`
    );

    return {
      action: 'updated',

      created: false,
      changed: true,
      replaced: false,
      edited: true,
      recovered: false,

      messageId:
        message.id,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | SEARCH FOR AN EXISTING PANEL
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
        messageId:
          existing.id,

        channelId:
          NORMAL_TICKET_CONFIG.channelId,

        configHash:
          panelHash,

        recoveredAt:
          new Date().toISOString(),
      }
    );

    console.log(
      `[Normal Tickets] Recovered existing panel (${existing.id}).`
    );

    return {
      action: 'unchanged',

      created: false,
      changed: false,
      replaced: false,
      edited: false,
      recovered: true,

      messageId:
        existing.id,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | SEND NEW PANEL
  |--------------------------------------------------------------------------
  */

  let message;

  try {
    message =
      await channel.send(
        payload
      );
  } catch (error) {
    console.error(
      '=================================================='
    );

    console.error(
      '[Normal Tickets] PANEL SEND FAILED'
    );

    console.error(
      error
    );

    console.error(
      '=================================================='
    );

    throw new Error(
      `Failed to send the Normal ticket panel: ${
        error?.message ||
        error
      }`
    );
  }

  /*
  |--------------------------------------------------------------------------
  | SAVE PANEL ID
  |--------------------------------------------------------------------------
  */

  await saveNormalPanelStorage(
    client,
    {
      messageId:
        message.id,

      channelId:
        NORMAL_TICKET_CONFIG.channelId,

      configHash:
        panelHash,

      createdAt:
        new Date().toISOString(),
    }
  );

  console.log(
    `[Normal Tickets] Panel created successfully (${message.id}).`
  );

  return {
    action: 'created',

    created: true,
    changed: true,
    replaced: false,
    edited: false,
    recovered: false,

    messageId:
      message.id,
  };
}

/*
|--------------------------------------------------------------------------
| GET NORMAL TICKET TYPE
|--------------------------------------------------------------------------
*/

export function getNormalTicketType(
  ticketTypeKey
) {
  return (
    NORMAL_TICKET_CONFIG.buttons.find(
      button =>
        button.key ===
        ticketTypeKey
    ) || null
  );
}

/*
|--------------------------------------------------------------------------
| BRAND COLOR
|--------------------------------------------------------------------------
*/

export const NORMAL_TICKET_BRAND_COLOR =
  BRAND_COLOR;
