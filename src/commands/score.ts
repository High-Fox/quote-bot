import { ApplicationCommandType, channelMention, ChatInputCommandInteraction, Events, MessageFlags, SlashCommandBuilder, User } from 'discord.js';
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
	const { score: memberScore, rank: memberRank } = await db.getMemberScore(scoreboard, user.id)
		.then(instance => instance ? instance.get() : { score: 0, rank: undefined });
	let text = `**${user.displayName}** has **${memberScore} quotes** in ${channelMention(scoreboard.channelId)}`;
	if (memberRank)
		text += `\n\nThey are ranked ${ordinalSuffix(memberRank)}!`;

	const container = containerBase()
		.addSectionComponents(section => {
			const avatar = user.avatarURL();
			if (avatar)
				section.setThumbnailAccessory(thumbnail => thumbnail.setURL(avatar));
			return section
				.addTextDisplayComponents(textDisplay => textDisplay.setContent(text));
		});

	return [container];
}