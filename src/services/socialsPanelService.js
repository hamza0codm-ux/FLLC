import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
} from 'discord.js';

const SOCIALS_CHANNEL_ID = '1541551382958579782';

const SOCIALS_IMAGE =
    'https://media.discordapp.net/attachments/1380169626171871282/1546404725593735209/4.jpg?ex=6aa24c21&is=6aa0faa1&hm=fa45f40fa566ede46d76b3f3b5f9e67460fd0368d05f13b69f58e1508151a1b1&=&format=webp&width=2048&height=682';

const SOCIALS = {
    twitter: {
        label: 'Twitter / X',
        url: 'https://x.com/FruityLLC',
        emoji: {
            name: 'TwitterX',
            id: '1545132417021648979',
        },
    },

    youtube: {
        label: 'YouTube',
        url: 'https://www.youtube.com/@FruityINC',
        emoji: {
            name: 'YouTube',
            id: '1545132069087223869',
        },
    },

    tiktok: {
        label: 'TikTok',
        url: 'https://www.tiktok.com/@fruity.inc',
        emoji: {
            name: 'TikTok',
            id: '1545132199504908418',
        },
    },
};

function createSocialsPanel() {
    const container = new ContainerBuilder()
        .setAccentColor(0xF8D568)

        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '# Fruity Socials\n' +
                'Stay connected with Fruity across all of our social platforms.'
            )
        )

        .addSeparatorComponents(
            new SeparatorBuilder()
                .setSpacing(SeparatorSpacingSize.Small)
        );

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel(SOCIALS.twitter.label)
            .setEmoji(SOCIALS.twitter.emoji)
            .setStyle(ButtonStyle.Link)
            .setURL(SOCIALS.twitter.url),

        new ButtonBuilder()
            .setLabel(SOCIALS.youtube.label)
            .setEmoji(SOCIALS.youtube.emoji)
            .setStyle(ButtonStyle.Link)
            .setURL(SOCIALS.youtube.url),

        new ButtonBuilder()
            .setLabel(SOCIALS.tiktok.label)
            .setEmoji(SOCIALS.tiktok.emoji)
            .setStyle(ButtonStyle.Link)
            .setURL(SOCIALS.tiktok.url),
    );

    container.addActionRowComponents(buttons);

    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
    );

    const image = new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(SOCIALS_IMAGE)
    );

    container.addMediaGalleryComponents(image);

    return container;
}

export async function reconcileSocialsPanel(client) {
    try {
        const channel = await client.channels
            .fetch(SOCIALS_CHANNEL_ID)
            .catch(() => null);

        if (!channel || !channel.isTextBased()) {
            return {
                action: 'error',
                error: `Socials channel ${SOCIALS_CHANNEL_ID} could not be found or is not text based.`,
            };
        }

        const messages = await channel.messages.fetch({
            limit: 20,
        });

        // Look for an existing Fruity Socials V2 panel.
        const existingPanel = messages.find((message) => {
            if (message.author?.id !== client.user.id) return false;

            const components = message.components ?? [];

            return components.some((component) => {
                const text =
                    component.content ??
                    component.components?.find?.(
                        (child) => child.content
                    )?.content ??
                    '';

                return text.includes('Fruity Socials');
            });
        });

        // Already exists — do nothing.
        if (existingPanel) {
            return {
                action: 'unchanged',
                messageId: existingPanel.id,
            };
        }

        // No panel exists, so create it.
        const panel = createSocialsPanel();

        const message = await channel.send({
            components: [panel],
            flags: MessageFlags.IsComponentsV2,
        });

        return {
            action: 'created',
            messageId: message.id,
        };
    } catch (error) {
        return {
            action: 'error',
            error: error?.message ?? String(error),
        };
    }
}
