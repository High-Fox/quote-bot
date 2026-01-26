import { ApplicationCommandType, CommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { Command } from '..';
import { getLogger } from '../../utils'

const logger = getLogger('command', 'test');
export const test: Command = {
	type: ApplicationCommandType.ChatInput,
	data: new SlashCommandBuilder()
		.setName('test')
		.setDescription('Does experimental testing stuff.'),
	execute: async (interaction: CommandInteraction) => {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		try {
			return interaction.editReply('Test completed.');
		} catch (error) {
			logger.error(error);
			await interaction.editReply('Error doing the test.');
		}
	}
}