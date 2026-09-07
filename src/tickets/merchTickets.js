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
| Edit everything for the merchandise ticket panel here.
*/

export const MERCH_TICKET_CONFIG = {
    key: 'merch',

    channelId: '1543031129559408660',
    categoryId: '1543352648021966949',
    staffRoleId: '1543556139462164480',

    ticketLogsChannelId: '1543331796568121467',
    transcriptLogsChannelId: '1543331916235931678',
    reviewLogsChannelId: '1543332129117708380',

    title: 'Merch Tickets',

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
| BUILD MERCH PANEL
|--------------------------------------------------------------------------
*/

export function buildMerchTicketPanel() {
    const container = new ContainerBuilder();

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ${MERCH_TICKET_CONFIG.title}\n${MERCH_TICKET_CONFIG.description}`
        )
    );

    container.addSeparatorComponents(
        new SeparatorBuilder()
    );

    container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(
                MERCH_TICKET_CONFIG.image
            )
        )
    );

    container.addSeparatorComponents(
        new SeparatorBuilder()
    );

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
            MERCH_TICKET_CONFIG.footer
        )
    );

    return [container];
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
| CREATE / UPDATE MERCH PANEL
|--------------------------------------------------------------------------
*/

export async function reconcileMerchTicketPanel(client) {
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

    const payload = {
        components:
            buildMerchTicketPanel(),

        flags:
            MessageFlags.IsComponentsV2,
    };

    const existing =
        await findMerchPanelMessage(channel);

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
| GET MERCH TICKET TYPE
|--------------------------------------------------------------------------
*/

export function getMerchTicketType(ticketTypeKey) {
    return (
        MERCH_TICKET_CONFIG.buttons.find(
            (button) =>
                button.key === ticketTypeKey
        ) || null
    );
}

export const MERCH_TICKET_BRAND_COLOR =
    BRAND_COLOR;
