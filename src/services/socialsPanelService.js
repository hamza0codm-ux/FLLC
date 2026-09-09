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
            .setSpacing(SeparatorSpacingSize.Large)
    );

// Twitter / X
container.addSectionComponents(
    new SectionBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `<:TwitterX:${SOCIALS.twitter.emoji.id}>  **Twitter / X**\n` +
                'Follow Fruity for the latest updates, announcements and news.'
            )
        )
        .setButtonAccessory(
            new ButtonBuilder()
                .setLabel('Twitter / X')
                .setEmoji(SOCIALS.twitter.emoji)
                .setStyle(ButtonStyle.Link)
                .setURL(SOCIALS.twitter.url)
        )
);

container.addSeparatorComponents(
    new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Large)
);

// YouTube
container.addSectionComponents(
    new SectionBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `<:YouTube:${SOCIALS.youtube.emoji.id}>  **YouTube**\n` +
                'Watch Fruity videos, updates and community content.'
            )
        )
        .setButtonAccessory(
            new ButtonBuilder()
                .setLabel('YouTube')
                .setEmoji(SOCIALS.youtube.emoji)
                .setStyle(ButtonStyle.Link)
                .setURL(SOCIALS.youtube.url)
        )
);

container.addSeparatorComponents(
    new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Large)
);

// TikTok
container.addSectionComponents(
    new SectionBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `<:TikTok:${SOCIALS.tiktok.emoji.id}>  **TikTok**\n` +
                'Check out Fruity on TikTok for short-form content and updates.'
            )
        )
        .setButtonAccessory(
            new ButtonBuilder()
                .setLabel('TikTok')
                .setEmoji(SOCIALS.tiktok.emoji)
                .setStyle(ButtonStyle.Link)
                .setURL(SOCIALS.tiktok.url)
        )
);

container.addSeparatorComponents(
    new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Large)
);

// Banner image
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

    const existingPanel = messages.find((message) => {
        if (message.author?.id !== client.user.id) {
            return false;
        }

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

    if (existingPanel) {
        return {
            action: 'unchanged',
            messageId: existingPanel.id,
        };
    }

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
