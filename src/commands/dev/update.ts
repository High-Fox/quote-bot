import { ApplicationCommandType, ChatInputCommandInteraction, GuildTextBasedChannel, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { Command } from '..';
import { newMessage } from '../../handlers/quote-handler';
import { getLogger } from '../../utils';
import { updateScoreboard } from '../../handlers/scoreboard-handler';
import * as db from '../../database';

const logger = getLogger('command', 'update');
export const update: Command = {
	type: ApplicationCommandType.ChatInput,
	data: new SlashCommandBuilder()
		.setName('update')
		.setDescription('Update all missed messages in a channel.')
		.addStringOption(option =>
			option
				.setName('channel')
				.setDescription('ID of the channel to update.')
				.setRequired(true)
		),
	execute: async (interaction: ChatInputCommandInteraction) => {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		const channelId = interaction.options.getString('channel', true);

		const scoreboard = await db.getScoreboard(channelId);
		if (!scoreboard)
			return interaction.editReply(`No scoreboard exists in channel ${channelId}.`);

		const channel = await interaction.client.channels.fetch(channelId) as GuildTextBasedChannel;
		if (!channel)
			return interaction.editReply('Error fetching channel.');

		const lastMessageId = await scoreboard.$get('scoredMessages', {
			attributes: ['messageId'],
			order: [['messageId', 'DESC']],
			limit: 1
		}).then(results => results[0].messageId);
		const messages = await channel.messages.fetch({
			after: lastMessageId
		}).catch(error => {
			logger.error(error);
			return null;
		});

		if (!messages)
			return interaction.editReply('Error fetching messages.')
		
		try {
			for (const [, message] of messages)
				await newMessage(scoreboard, message);
			await updateScoreboard(channelId, channel.messages);
		} catch (error) {
			logger.fatal(error);
			return interaction.editReply('Error updating messages.');
		}
		return interaction.editReply(`Processed ${messages.size} messages.`);
	}
}