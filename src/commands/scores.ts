import { ActionRowBuilder, ApplicationCommandType, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, MessageFlags, SlashCommandBuilder, userMention } from "discord.js";
import { Command } from ".";
import { MemberScore, Scoreboard } from "../database/models";
import { containerBase } from "../utils";
import * as db from '../database'

const SCORES_NEXT_PAGE = 'scoresNextPage';
const SCORES_PREVIOUS_PAGE = 'scoresPrevPage';
const SCORES_PER_PAGE = 10;

export const scores: Command = {
	type: ApplicationCommandType.ChatInput,
	data: new SlashCommandBuilder()
		.setName('scores')
		.setDescription('Browse the full ranking of quote scores within this channel.'),
	execute: async (interaction: ChatInputCommandInteraction) => {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		const replyMessage = await interaction.fetchReply();

		const scoreboard = await db.getScoreboard(interaction.channelId);
		if (!scoreboard)
			return interaction.editReply('No scoreboard exists in this channel.');

		let page = 0;
		const pagedScores = await getPagedScores(scoreboard);
		const pages = pagedScores.map((memberScores, index) => createComponents(pagedScores, index));
		await interaction.editReply({
			components: pages[page],
			flags: MessageFlags.IsComponentsV2
		});

		replyMessage.createMessageComponentCollector({
			componentType: ComponentType.Button,
			filter: (button) => button.user.id === interaction.user.id && 
				(button.customId === SCORES_NEXT_PAGE || button.customId === SCORES_PREVIOUS_PAGE),
			idle: 35_000
		}).on('collect', async (componentInteraction) => {
			page += componentInteraction.customId === SCORES_NEXT_PAGE ? 1 : -1;
			await componentInteraction.update({
				components: pages[page]
			});
		}).once('end', async () => {
			await interaction.deleteReply();
		});
	}
}

const createComponents = (pagedScores: MemberScore[][][], page: number) => {
	const container = containerBase()
		.addTextDisplayComponents(textDisplay => textDisplay.setContent('## 🏆  Scores'))
		.addSeparatorComponents(seperator => seperator)
		.addTextDisplayComponents(textDisplay => textDisplay.setContent(
			pagedScores[page].reduce((text, memberScores, index) => {
				return text + `${page * SCORES_PER_PAGE + index + 1}. ${memberScores.map(memberScore => userMention(memberScore.memberId)).join(', ')} - **${memberScores[0].score} Quotes**\n`;
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
		order: [['score', 'DESC']]
	}).then(results => {
		let index = 0;
		let currentScore = 0;
		return results.reduce((pages, score) => {
			const pageIndex = Math.floor(index / SCORES_PER_PAGE);
			const page = pages[pageIndex] ??= [];

			if (score.score === currentScore && page.length)
				page[page.length - 1].push(score);
			else {
				page.push([score]);
				index++;
			}

			currentScore = score.score;
			return pages;
		}, <MemberScore[][][]>[]);
	});
}