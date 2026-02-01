import { ApplicationCommandType, channelMention, ChatInputCommandInteraction, Events, MediaGalleryBuilder, MessageFlags, SlashCommandBuilder, User, userMention } from 'discord.js';
import { Op } from 'sequelize';
import { Command } from '.';
import { containerBase, ordinalSuffix } from '../utils';
import { subscribe } from '../handlers/event-handler';
import { MemberScore, Scoreboard } from '../database/models/';
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
	const memberScore = await db.getMemberScore(scoreboard, user.id);
	if (!memberScore)
		return [new MediaGalleryBuilder().addItems(galleryItem => galleryItem.setURL('https://en.meming.world/images/en/0/03/I%27ve_Never_Met_This_Man_In_My_Life.jpg'))];

	let text = `**${user}** has **${memberScore.score} quotes** in ${channelMention(scoreboard.channelId)}`;
	const rank = memberScore.get('rank');
	if (rank) {
		const tiedWith = await getTiedWith(scoreboard, memberScore);
		text += !tiedWith.length ? `\n\nThey are ranked ${ordinalSuffix(rank)}!`
			: `\n\nThey are tied for ${ordinalSuffix(rank)} with ${tiedWith.map(userMention).join(', ')}.`;
	}

	const container = containerBase()
		.addSectionComponents(section => {
			section.setThumbnailAccessory(thumbnail => thumbnail.setURL(user.displayAvatarURL()));
			return section.addTextDisplayComponents(textDisplay => textDisplay.setContent(text));
		});

	return [container];
}

const getTiedWith = (scoreboard: Scoreboard, memberScore: MemberScore) => {
	return scoreboard.$get('memberScores', {
		attributes: ['memberId'],
		where: {
			score: memberScore.score,
			memberId: {
				[Op.not]: memberScore.memberId
			}
		}
	}).then(results => results.map(instance => instance.memberId));
}