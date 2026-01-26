import { ApplicationCommandType, CommandInteraction, ContainerBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
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
			const container = new ContainerBuilder()
				.setAccentColor(0xC678E3)
				.addTextDisplayComponents(textDisplay =>
					textDisplay.setContent('# 💬 Quote Scoreboard\nHere we remember those who have said the weirdest shit.')
				)
				.addSeparatorComponents(seperator => seperator);
			return interaction.editReply({
				components: [container],
				flags: MessageFlags.IsComponentsV2
			})
		} catch (error) {
			logger.fatal(error);
			await interaction.editReply('Error doing the test.');
		}
	}
}