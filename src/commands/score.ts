import { ApplicationCommandType, channelMention, ChatInputCommandInteraction, Events, MediaGalleryBuilder, MessageFlags, SlashCommandBuilder, TextDisplayBuilder, User } from 'discord.js';
import { Command } from '.';
import { containerBase, ordinalSuffix } from '../utils';
import { subscribe } from '../handlers/event-handler';
import { Scoreboard } from '../database/models/';
import { SCORE_USER_SELECT } from '../handlers/scoreboard-handler';
import * as db from '../database';

export const score: Command = {
	type: ApplicationCommandType.ChatInput,
	data: new SlashCommandBuilder()
		.setName('score')
		.setDescription('Gets the quote score of you or another user within this channel.')
		.addUserOption(option =>
			option
				.setName('user')
				.setDescription('The user to get the score of. Leave blank to get your own score.')),
	execute: async (interaction: ChatInputCommandInteraction) => {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const scoreboard = await db.getScoreboard(interaction.channelId);
		if (!scoreboard)
			return interaction.editReply('No scoreboard exists in this channel.');

		const user = interaction.options.getUser('user') ?? interaction.user;

		return createComponents(scoreboard, user)
			.then(components => interaction.editReply({
				components,
				flags: MessageFlags.IsComponentsV2
			}));
	}
}

subscribe('on', Events.InteractionCreate, async (interaction) => {
	if (interaction.isUserSelectMenu() && interaction.customId === SCORE_USER_SELECT) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const scoreboard = await db.getScoreboard(interaction.channelId);
		if (!scoreboard)
			return interaction.editReply('Error retrieving scoreboard.');
		const user = interaction.users.first();
		if (!user)
			return interaction.editReply('Error fetching specified user.');

		return createComponents(scoreboard, user)
			.then(components => interaction.editReply({
				components,
				flags: MessageFlags.IsComponentsV2
			}));
	}
});

const createComponents = async (scoreboard: Scoreboard, user: User) => {
	const memberScore = await db.getMemberScore(scoreboard, user.id)
		.then(instance => instance ? instance.get() : null);
	
	if (!memberScore)
		return [new MediaGalleryBuilder().addItems(galleryItem => galleryItem.setURL('https://en.meming.world/images/en/0/03/I%27ve_Never_Met_This_Man_In_My_Life.jpg'))];

	let text = `**${user.displayName}** has **${memberScore.score} quotes** in ${channelMention(scoreboard.channelId)}`;
	if (memberScore.rank)
		text += `\n\nThey are ranked ${ordinalSuffix(memberScore.rank)}!`;

	const container = containerBase();
	const textDisplay = new TextDisplayBuilder().setContent(text);
	if (user.avatarURL()) {
		container.addSectionComponents(section => {
			section.setThumbnailAccessory(thumbnail => thumbnail.setURL(user.avatarURL()!));
			return section.addTextDisplayComponents(textDisplay);
		});
	} else
		container.addTextDisplayComponents(textDisplay);

	return [container];
}