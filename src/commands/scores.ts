import { ActionRowBuilder, ApplicationCommandType, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, MessageFlags, SlashCommandBuilder, userMention } from "discord.js";
import { Command } from ".";
import * as db from '../database'
import { MemberScore, Scoreboard } from "../database/models";
import { containerBase } from "../utils";
import { Sequelize } from "sequelize";

const SCORES_NEXT_PAGE = 'scoresNextPage';
const SCORES_PREVIOUS_PAGE = 'scoresPrevPage';
const SCORES_PER_PAGE = 10;

export const scores: Command = {
	type: ApplicationCommandType.ChatInput,
	data: new SlashCommandBuilder()
		.setName('scores')
		.setDescription('View everyone\'s quote scores and rank within this channel.'),
	execute: async (interaction: ChatInputCommandInteraction) => {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		const replyMessage = await interaction.fetchReply();

		const scoreboard = await db.getScoreboard(interaction.channelId);
		if (!scoreboard)
			return interaction.editReply('No scoreboard exists in this channel.');

		let page = 0;
		const pagedScores = await getPagedScores(scoreboard);
		await interaction.editReply({
			components: createComponents(pagedScores, page),
			flags: MessageFlags.IsComponentsV2
		});

		const collector = replyMessage.createMessageComponentCollector({
			componentType: ComponentType.Button,
			filter: (button) => button.user.id === interaction.user.id && 
				(button.customId === SCORES_NEXT_PAGE || button.customId === SCORES_PREVIOUS_PAGE),
			idle: 35_000
		});

		collector.on('collect', async (componentInteraction) => {
			await componentInteraction.deferUpdate();
			page += componentInteraction.customId === SCORES_NEXT_PAGE ? 1 : -1;
			await componentInteraction.update({
				components: createComponents(pagedScores, page)
			});
		});
		collector.once('end', async () => {
			await interaction.deleteReply();
		});
	}
}

const createComponents = (pagedScores: MemberScore[][], page: number) => {
	const memberScores = pagedScores[page];
	const container = containerBase()
		.addSeparatorComponents(seperator => seperator.setDivider(false))
		.addTextDisplayComponents(textDisplay => textDisplay.setContent('## 🏆 Scores'))
		.addTextDisplayComponents(textDisplay => textDisplay.setContent(
			memberScores
				.map(memberScore => memberScore.get())
				.reduce((text, { memberId, score, rank }) => {
					return text + `${rank}. ${userMention(memberId)} - **${score} Quotes**\n`;
				}, '')
		));
	const actionRow = new ActionRowBuilder<ButtonBuilder>()
		.addComponents(
			new ButtonBuilder()
				.setCustomId(SCORES_PREVIOUS_PAGE)
				.setLabel('⬅️ Previous Page')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(page === 0),
			new ButtonBuilder()
				.setCustomId(SCORES_NEXT_PAGE)
				.setLabel('Next Page ➡️')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(pagedScores.length === page + 1)
		);
	return pagedScores.length > 1 ? [container, actionRow] : [container];
}

const getPagedScores = (scoreboard: Scoreboard) => {
	return scoreboard.$get('memberScores', {
		attributes: {
			include: [
				[Sequelize.literal('(RANK() OVER (ORDER BY score DESC))'), 'rank']
			]
		},
		order: [['score', 'DESC']]
	}).then(results => results.reduce((pages, score, index) => {
		const pageIndex = Math.floor(index / SCORES_PER_PAGE);

		if (!pages[pageIndex])
			pages[pageIndex] = [];
		pages[pageIndex].push(score);

		return pages;
	}, <MemberScore[][]>[]));
}