import { ApplicationCommandType, ChatInputCommandInteraction, GuildTextBasedChannel, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { Command } from '..';
import { newMessage, updateMessage } from '../../handlers/quote-handler';
import { getLogger } from '../../utils';
import { updateScoreboard } from '../../handlers/scoreboard-handler';
import * as db from '../../database'

const logger = getLogger('command', 'update');
export const update: Command = {
	type: ApplicationCommandType.ChatInput,
	data: new SlashCommandBuilder()
		.setName('update')
		.setDescription('Manually process a message.')
		.addStringOption(option =>
			option
				.setName('channel')
				.setDescription('Channel ID containing the message.')
				.setRequired(true)
		)
		.addStringOption(option =>
			option
				.setName('message')
				.setDescription('Message ID to process.')
				.setRequired(true)
		),
	execute: async (interaction: ChatInputCommandInteraction) => {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		const channelId = interaction.options.getString('channel', true);
		const messageId = interaction.options.getString('message', true);

		const scoreboard = await db.getScoreboard(channelId);
		if (!scoreboard)
			return interaction.editReply(`No scoreboard exists in channel ${channelId}.`);

		const channel = await interaction.client.channels.fetch(channelId) as GuildTextBasedChannel;
		if (!channel)
			return interaction.editReply('Error fetching channel.');

		const message = await channel.messages.fetch(messageId)
			.catch(() => {
				interaction.editReply('Error fetching message.');
				return null;
			});
		if (!message)
			return;
		
		try {
			if (await db.hasScoredMessage(messageId))
				await updateMessage(scoreboard, message);
			else
				await newMessage(scoreboard, message);
			await updateScoreboard(channelId, channel.messages);
			return interaction.editReply('Processing complete!');
		} catch (error) {
			logger.fatal(error);
			return interaction.editReply('Error updating message.');
		}
	}
}