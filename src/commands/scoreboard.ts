import { ApplicationCommandType, ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '.';
import { getLogger } from '../utils';
import { removeScoreboard, setupScoreboard } from '../handlers/scoreboard-handler';
import * as db from '../database';

const logger = getLogger('command', 'scoreboard');
export const scoreboard: Command = {
	type: ApplicationCommandType.ChatInput,
	data: new SlashCommandBuilder()
		.setName('scoreboard')
		.setDescription('Scoreboard management commands.')
		.addSubcommand(subcommand =>
			subcommand
				.setName('create')
				.setDescription('Create a scoreboard in this channel.')
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('delete')
				.setDescription('Delete the scoreboard in this channel.')
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels | PermissionFlagsBits.ManageMessages),
	execute: {
		create: async (interaction: ChatInputCommandInteraction<'raw' | 'cached'>) => {
			if (await db.getScoreboard(interaction.channelId))
				return interaction.reply({ content: 'A scoreboard already exists in this channel.', flags: MessageFlags.Ephemeral });
			if (!interaction.channel)
				throw new Error('Channel not present in interaction object.');
			
			await interaction.deferReply();
			const replyMessage = await interaction.fetchReply();
			try {
				return setupScoreboard(interaction.channel, replyMessage)
					.then(reply => interaction.editReply(reply));
			} catch (error) {
				logger.error(error);
				return interaction.editReply('An error occured while creating the scoreboard.');
			}
		},
		delete: async (interaction: ChatInputCommandInteraction<'raw' | 'cached'>) => {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			const scoreboard = await db.getScoreboard(interaction.channelId!);
			if (!scoreboard)
				return interaction.editReply('No scoreboard exists in this channel.');
			if (!interaction.channel)
				throw new Error('Channel not present in interaction object.');

			try {
				return removeScoreboard(scoreboard, interaction.channel.messages)
					.then(() => interaction.editReply('Scoreboard deleted successfully!'));
			} catch (error) {
				logger.error(error);
				return interaction.editReply('An error occurred while deleting the scoreboard.');
			}
		}
	}
}