// src/tickets/normalTickets.js

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

  title: '🎟️ Fruity Tickets',

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
| BUILD NORMAL TICKET PANEL
|--------------------------------------------------------------------------
*/

export function buildNormalTicketPanel() {
  const container = new ContainerBuilder();

  /*
  |--------------------------------------------------------------------------
  | TITLE
  |--------------------------------------------------------------------------
  */

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## ${NORMAL_TICKET_CONFIG.title}\n${NORMAL_TICKET_CONFIG.description}`
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
        NORMAL_TICKET_CONFIG.image
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
  | TICKET OPTIONS
  |--------------------------------------------------------------------------
  */

  for (const button of NORMAL_TICKET_CONFIG.buttons) {
    const ticketButton = new ButtonBuilder()
      .setCustomId(
        `create_ticket:normal:${button.key}`
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
      NORMAL_TICKET_CONFIG.footer
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

    normalized[key] = normalizeComponent(item);
  }

  return normalized;
}

/*
|--------------------------------------------------------------------------
| GET PANEL STRUCTURE
|--------------------------------------------------------------------------
*/

function getNormalPanelStructure(messageOrComponents) {
  const components = Array.isArray(messageOrComponents)
    ? messageOrComponents
    : messageOrComponents?.components || [];

  return normalizeComponent(
    components.map((component) => {
      if (typeof component?.toJSON === 'function') {
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

function normalPanelChanged(
  existingMessage,
  newComponents
) {
  const existingStructure =
    getNormalPanelStructure(
      existingMessage.components
    );

  const newStructure =
    getNormalPanelStructure(
      newComponents
    );

  return (
    JSON.stringify(existingStructure) !==
    JSON.stringify(newStructure)
  );
}

/*
|--------------------------------------------------------------------------
| FIND EXISTING NORMAL PANEL
|--------------------------------------------------------------------------
*/

async function findNormalPanelMessage(channel) {
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
          getNormalPanelStructure(
            message.components
          );

        const json =
          JSON.stringify(structure);

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
| CREATE / REPLACE NORMAL PANEL
|--------------------------------------------------------------------------
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

  const payload = {
    components,
    flags: MessageFlags.IsComponentsV2,
  };

  const existing =
    await findNormalPanelMessage(channel);

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
    !normalPanelChanged(
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
