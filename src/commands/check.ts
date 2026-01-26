import { ApplicationCommandType, ContextMenuCommandBuilder, MessageContextMenuCommandInteraction, MessageFlags, userMention } from "discord.js";
import { Command } from ".";
import { resolveQuoteTuples } from "../handlers/quote-handler";

export const check: Command = {
	type: ApplicationCommandType.Message,
	data: new ContextMenuCommandBuilder()
		.setType(ApplicationCommandType.Message)
		.setName('check'),
	execute: async (interaction: MessageContextMenuCommandInteraction<'raw' | 'cached'>) => {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		if (!interaction.targetMessage.inGuild())
			return interaction.editReply('Must be in a guild.');

		const quotes = await resolveQuoteTuples(interaction.targetMessage);
		if (!quotes.length)
			return interaction.editReply('No quotes found.');

		return interaction.editReply(
			quotes.reduce((text, [quote, quotees]) => {
				return text + `${quote} - ${quotees.map(userMention).join(', ')}\n`;
			}, '')
		);
	}
}