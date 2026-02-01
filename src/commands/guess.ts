import { ApplicationCommandType, ChatInputCommandInteraction, ComponentType, GuildMessageManager, MessageFlags, SlashCommandBuilder, userMention, UserSelectMenuBuilder } from 'discord.js';
import { QuoteTuple, resolveQuoteTuples } from '../handlers/quote-handler';
import { Command } from '.';
import { containerBase } from '../utils';
import { Scoreboard } from '../database/models/';
import * as db from '../database';

const GUESS_USER_SELECT = 'guessUserSelect';

export const guess: Command = {
	type: ApplicationCommandType.ChatInput,
	data: new SlashCommandBuilder()
		.setName('guess')
		.setDescription('Guess who said a quote!'),
	execute: async (interaction: ChatInputCommandInteraction<'raw' | 'cached'>) => {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		const replyMessage = await interaction.fetchReply();

		const scoreboard = await db.getScoreboard(interaction.channelId);
		if (!scoreboard)
			return interaction.editReply('No scoreboard exists in this channel.');
		if (!interaction.channel)
			throw new Error('Channel not present in interaction object.');

		const quote = await getRandomQuote(scoreboard, interaction.channel.messages);
		await interaction.editReply({
			components: createQuestionComponents(quote),
			flags: MessageFlags.IsComponentsV2
		});

		await replyMessage.awaitMessageComponent<ComponentType.UserSelect>({
			filter: (componentInteraction) => componentInteraction.user.id === interaction.user.id && 
				componentInteraction.customId === GUESS_USER_SELECT,
			idle: 30_000
		}).then(response => {
			return response.update({
				components: createAnswerComponents(quote, response.values)
			});
		}).catch(() => {
			const timeoutComponent = containerBase('Red')
				.addTextDisplayComponents(textDisplay => textDisplay.setContent('Timed out due to no response.'));
			return interaction.editReply({ components: [timeoutComponent] });
		});
	}
}

const getRandomQuote = async (scoreboard: Scoreboard, messages: GuildMessageManager) => {
	const scoredMessage = await scoreboard.$get('scoredMessages', {
		attributes: ['messageId'],
		order: db.connection.random(),
		limit: 1
	}).then(results => results[0]);
	
	const quotes = await messages.fetch(scoredMessage.messageId)
		.then(message => resolveQuoteTuples(message));

	return quotes[Math.floor(Math.random() * quotes.length)];
}

const quoteContainerBase = (sectionText: string) => {
	return containerBase()
		.addTextDisplayComponents(textDisplay => textDisplay.setContent(`### Who said that!?\n${sectionText}`))
		.addSeparatorComponents(seperator => seperator);
}

const createQuestionComponents = ([quote, quotees]: QuoteTuple) => {
	const selectMenu = new UserSelectMenuBuilder()
		.setCustomId(GUESS_USER_SELECT)
		.setPlaceholder('Select users...')
		.setMaxValues(quotees.length);
	const container = quoteContainerBase(`>>> ${quote}`);
	if (quotees.length > 1)
		container.addTextDisplayComponents(textDisplay => textDisplay.setContent(`-# This quote has ${quotees.length} quotees, try and guess them all!`));
	container.addActionRowComponents(actionRow => actionRow.addComponents(selectMenu));

	return [container];
}

const createAnswerComponents = ([quote, quotees]: QuoteTuple, selectedUsers: string[]) => {
	if (quotees.length > selectedUsers.length)
		selectedUsers = selectedUsers.fill('N/A', selectedUsers.length, quotees.length - 1);
	const results = selectedUsers.reduce((text, userId) => {
		if (text !== 'N/A')
			text += `\n- ${userMention(userId)} ${quotees.includes(userId) ? '✅' : '❌'}`;
		return text;
	}, 'You guessed the following:');
	const amountCorrect = selectedUsers.filter(userId => quotees.includes(userId)).length;
	const container = quoteContainerBase(`>>> ${quote}\n\\- ${quotees.map(userMention).join('')}`)
		.addTextDisplayComponents(
			textDisplay => textDisplay.setContent(results),
			textDisplay => textDisplay.setContent(`You got ${amountCorrect} out of ${quotees.length} correct!`)
		);
	
	return [container];
}