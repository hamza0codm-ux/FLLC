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

  title: '🎫 Fruity Tickets',

  description:
    'Need help with Fruity? Select the option below that best matches what you need.',

  image:
    'https://media.discordapp.net/attachments/1380169626171871282/1546404725870563368/5.jpg?ex=6a9fa921&is=6a9e57a1&hm=5ecc5e7b557398bd5863b5d29e32be71fb4f50dead1bda411c88a54690dd287c&=&format=webp&width=2048&height=682',

  footer:
    '🎫 Select the button that best matches your request to open a Fruity support ticket.',

  teamText:
    'The Fruity Support Team will assist you shortly,',

  buttons: [
    {
      key: 'fruity_application',
      label: 'Fruity Application',
      description: 'Apply to join Fruity.',
      emoji: '<:Applications:1546395023413878836>',
    },

    {
      key: 'general_faq',
      label: 'General FAQ',
      description: 'Ask a general question about Fruity.',
      emoji: '<:Questions:1546395162136154122>',
    },

    {
      key: 'staff_applications',
      label: 'Staff Applications',
      description: 'Apply for a staff position.',
      emoji: '<a:Briefcase:1546395107547156563>',
    },
  ],
};

/*
|--------------------------------------------------------------------------
| DATABASE STORAGE
|--------------------------------------------------------------------------
|
| The panel message ID and panel configuration hash are stored separately
| for the Normal panel.
|
| This means a bot restart does NOT create a new panel.
|
*/

const NORMAL_PANEL_STORAGE_KEY =
  'fruity:ticket-panels:normal';

/*
|--------------------------------------------------------------------------
| BUILD NORMAL TICKET PANEL
|--------------------------------------------------------------------------
*/

export function buildNormalTicketPanel() {
  const container = new ContainerBuilder();

  /*
  |--------------------------------------------------------------------------
  | TITLE + DESCRIPTION
  |--------------------------------------------------------------------------
  */

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## ${NORMAL_TICKET_CONFIG.title}\n${NORMAL_TICKET_CONFIG.description}`
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
    i < NORMAL_TICKET_CONFIG.buttons.length;
    i++
  ) {
    const button =
      NORMAL_TICKET_CONFIG.buttons[i];

    const ticketButton =
      new ButtonBuilder()
        .setCustomId(
          `create_ticket:normal:${button.id}`
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
      NORMAL_TICKET_CONFIG.buttons.length - 1
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
        NORMAL_TICKET_CONFIG.image
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
      NORMAL_TICKET_CONFIG.footer
    )
  );

  return [container];
}

/*
|--------------------------------------------------------------------------
| PANEL CONFIG HASH
|--------------------------------------------------------------------------
|
| We intentionally hash only the panel's actual visual/configuration data.
|
| We do NOT hash Discord's returned Components V2 JSON.
|
| This is the important part that prevents false "changed" detections
| after a restart.
|
*/

function getNormalPanelHash() {
  const panelDefinition = {
    key: NORMAL_TICKET_CONFIG.key,
    title: NORMAL_TICKET_CONFIG.title,
    description: NORMAL_TICKET_CONFIG.description,
    image: NORMAL_TICKET_CONFIG.image,
    footer: NORMAL_TICKET_CONFIG.footer,
    teamText: NORMAL_TICKET_CONFIG.teamText,

    buttons: NORMAL_TICKET_CONFIG.buttons.map(
      (button) => ({
        key: button.key,
        label: button.label,
        description: button.description,
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
  } catch {
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
  } catch {
    return false;
  }
}

/*
|--------------------------------------------------------------------------
| FIND EXISTING NORMAL PANEL
|--------------------------------------------------------------------------
|
| Used ONLY when we don't have a valid stored message ID.
|
| This prevents duplicate panels if the database was reset while the
| actual Discord panel still exists.
|
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
          'create_ticket:normal:'
        );
      }) || null
    );
  } catch {
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

  /*
  |--------------------------------------------------------------------------
  | Make sure the stored message really is the Normal ticket panel.
  |--------------------------------------------------------------------------
  */

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
      'create_ticket:normal:'
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
| IMPORTANT BEHAVIOR:
|
| 1. Existing stored message + same config hash:
|       DO NOTHING.
|
| 2. Existing stored message + different config hash:
|       EDIT THE EXISTING MESSAGE.
|
| 3. Stored message deleted:
|       Search for another existing panel first.
|
| 4. No panel exists anywhere:
|       CREATE ONE.
|
| This makes restarts completely safe.
|
*/

export async function reconcileNormalTicketPanel(
  client
) {
  const channel =
    await client.channels
      .fetch(
        NORMAL_TICKET_CONFIG.channelId
      )
      .catch(() => null);

  if (!channel?.isTextBased()) {
    throw new Error(
      `Normal ticket panel channel ${NORMAL_TICKET_CONFIG.channelId} was not found.`
    );
  }

  const components =
    buildNormalTicketPanel();

  const panelHash =
    getNormalPanelHash();

  const payload = {
    components,
    flags: MessageFlags.IsComponentsV2,
  };

  /*
  |--------------------------------------------------------------------------
  | STEP 1 — Try the persisted message ID
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
    | SAME PANEL CONFIG
    |--------------------------------------------------------------------------
    |
    | This is the normal restart path.
    |
    | DO NOT EDIT.
    | DO NOT SEND.
    | DO NOT DELETE.
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
    | PANEL CONFIG CHANGED
    |--------------------------------------------------------------------------
    |
    | Edit the existing Discord message.
    |
    | We do NOT send a new message.
    |--------------------------------------------------------------------------
    */

    await message.edit(payload);

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
  | STEP 2 — Stored ID missing/deleted
  |--------------------------------------------------------------------------
  |
  | Before creating anything, search the channel.
  |
  | This is critical if the database was reset but the Discord panel
  | still exists.
  |--------------------------------------------------------------------------
  */

  const existing =
    await findExistingNormalPanel(
      channel,
      client
    );

  if (existing) {
    /*
    |--------------------------------------------------------------------------
    | Recover existing panel ID.
    |--------------------------------------------------------------------------
    |
    | We do NOT create another panel.
    |
    | We simply recover the ID and store it.
    |--------------------------------------------------------------------------
    */

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
  | STEP 3 — NOTHING EXISTS
  |--------------------------------------------------------------------------
  |
  | Only now are we allowed to create a new panel.
  |--------------------------------------------------------------------------
  */

  const message =
    await channel.send(payload);

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
| GET NORMAL TICKET TYPE
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
