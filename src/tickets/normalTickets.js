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
| Edit everything for the normal Fruity ticket panel here.
*/

export const NORMAL_TICKET_CONFIG = {
    key: 'normal',

    channelId: '1541551721908801576',
    categoryId: '1542428718826524723',
    staffRoleId: '1541554350797619230',

    ticketLogsChannelId: '1542845775988391937',
    transcriptLogsChannelId: '1542845853310390342',
    reviewLogsChannelId: '1542859014499467285',

    title: 'Fruity Tickets',

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
| BUILD NORMAL PANEL
|--------------------------------------------------------------------------
*/

export function buildNormalTicketPanel() {
    const container = new ContainerBuilder();

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ${NORMAL_TICKET_CONFIG.title}\n${NORMAL_TICKET_CONFIG.description}`
        )
    );

    container.addSeparatorComponents(
        new SeparatorBuilder()
    );

    container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(
                NORMAL_TICKET_CONFIG.image
            )
        )
    );

    container.addSeparatorComponents(
        new SeparatorBuilder()
    );

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
                    `**${button.label}**\n${button.description}`
                )
            )
            .setButtonAccessory(ticketButton);

        container.addSectionComponents(section);

        container.addSeparatorComponents(
            new SeparatorBuilder()
        );
    }

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            NORMAL_TICKET_CONFIG.footer
        )
    );

    return [container];
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

        return messages.find(
            (message) =>
                message.author?.id ===
                    channel.client.user.id &&
                message.components?.length > 0
        ) || null;
    } catch {
        return null;
    }
}


/*
|--------------------------------------------------------------------------
| CREATE / UPDATE NORMAL PANEL
|--------------------------------------------------------------------------
*/

export async function reconcileNormalTicketPanel(client) {
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

    const payload = {
        components:
            buildNormalTicketPanel(),

        flags:
            MessageFlags.IsComponentsV2,
    };

    const existing =
        await findNormalPanelMessage(channel);

    if (existing) {
        await existing.edit(payload);

        return {
            created: false,
            messageId: existing.id,
        };
    }

    const message =
        await channel.send(payload);

    return {
        created: true,
        messageId: message.id,
    };
}


/*
|--------------------------------------------------------------------------
| GET NORMAL TICKET TYPE
|--------------------------------------------------------------------------
*/

export function getNormalTicketType(ticketTypeKey) {
    return (
        NORMAL_TICKET_CONFIG.buttons.find(
            (button) =>
                button.key === ticketTypeKey
        ) || null
    );
}

export const NORMAL_TICKET_BRAND_COLOR =
    BRAND_COLOR;
