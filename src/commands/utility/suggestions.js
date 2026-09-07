import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';

const PUBLIC_CHANNEL_ID = '1545071209429999736';

const SUGGESTION_EMOJI = {
    name: 'Suggestion',
    id: '1546240756073893950',
    animated: true,
};

const LOADING_EMOJI = {
    name: 'Loading',
    id: '1546268064008642641',
    animated: true,
};

const PANEL_IMAGE =
    'https://media.discordapp.net/attachments/1380169626171871282/1546564480840892446/content.png?ex=6aa03dea&is=6a9eec6a&hm=045e45dbe397a20550ffef10a28971d4f7db835c0c16d70109930216eddd15cf&=&format=webp&quality=lossless&width=768&height=256';

export default {
    data: new SlashCommandBuilder()
        .setName('suggestions')
        .setDescription('Manage the Fruity suggestion system.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('panel')
                .setDescription('Send the Fruity suggestion panel.')
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({
                content: 'You do not have permission to use this command.',
                ephemeral: true,
            });
        }

        if (interaction.options.getSubcommand() !== 'panel') {
            return;
        }

        const channel = await interaction.client.channels.fetch(PUBLIC_CHANNEL_ID);

        if (!channel || !channel.isTextBased()) {
            return interaction.reply({
                content: 'The configured suggestion channel could not be found.',
                ephemeral: true,
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#F8D568')
            .setTitle('Have your ideas heard at Fruity')
            .setDescription(
                'Have an idea, improvement, or suggestion for Fruity?\n' +
                'We want to hear what you think. Submit your idea below and our Management team will review it.'
            )
            .setImage(PANEL_IMAGE);

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('suggestion:submit')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(SUGGESTION_EMOJI)
                .setLabel('Submit'),

            new ButtonBuilder()
                .setCustomId('suggestion:status')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(LOADING_EMOJI)
                .setLabel('My status')
        );

        await channel.send({
            embeds: [embed],
            components: [buttons],
        });

        await interaction.reply({
            content: `Suggestion panel sent to <#${PUBLIC_CHANNEL_ID}>.`,
            ephemeral: true,
        });
    },
};
