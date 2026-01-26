import { ApplicationCommandType, ChatInputCommandInteraction, ContextMenuCommandInteraction, Events, REST, Routes } from 'discord.js';
import { config } from '../config';
import { ChatCommand, Commands, CommandScopes, CommandScope, SubcommandsCommand } from '../commands';
import { getLogger } from '../utils';
import { subscribe } from './event-handler';
import meow from 'meow';

const logger = getLogger();
const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);
const commandsData = Object.fromEntries(
	Object.entries(Commands).map(([key, commands]) => {
		const data = Object.values(commands).map(command => command.data.toJSON());
		return [key, data];
	})
);

const hasSubcommands = (command: ChatCommand): command is SubcommandsCommand => {
	return typeof command.execute !== 'function';
}

subscribe('once', Events.ClientReady, async () => {
	const { flags } = meow({
		importMeta: import.meta,
		flags: {
			deployCommands: {
				type: 'string',
				choices: ['dev', 'global']
			}
		}
	});
	if (flags.deployCommands) {
		if (flags.deployCommands === 'dev')
			deployToGuild({ guildId: config.DEV_GUILD_ID, scope: CommandScopes.ALL})
		else
			deployGlobally();
	}
});

export const handleChatCommand = async (interaction: ChatInputCommandInteraction<'raw' | 'cached'>) => {
	const { commandName, options, guild } = interaction;
	const commands = guild?.id === config.DEV_GUILD_ID ? Commands.ALL : Commands.USER;
	const command = commands[commandName as keyof typeof commands];

	if (!command || command.type !== ApplicationCommandType.ChatInput)
		throw new Error(`Unknown chat command ${commandName}!`);

	const subcommand = options.getSubcommand(false);
	if (subcommand) {
		if (!hasSubcommands(command))
			throw new Error(`Command type mismatch: Expected subcommands object in ${commandName}.`)
		if (!command.execute[subcommand])
			throw new Error(`Command ${commandName} is missing subcommand ${subcommand}.`);

		await command.execute[subcommand](interaction);
	} else {
		if (hasSubcommands(command))
			throw new Error(`Command type mismatch: Unexpected subcommands object in ${commandName}.`)

		await command.execute(interaction);
	}
}

export const handleContextMenuCommand = async (interaction: ContextMenuCommandInteraction<'raw' | 'cached'>) => {
	const { commandName, guild } = interaction;
	const commands = guild?.id === config.DEV_GUILD_ID ? Commands.ALL : Commands.USER;
	const command = commands[commandName as keyof typeof commands];

	if (!command)
		throw new Error(`Unknown context menu command ${commandName}!`);

	if (command.type === ApplicationCommandType.Message && interaction.isMessageContextMenuCommand())
		command.execute(interaction);
	else if (command.type === ApplicationCommandType.User && interaction.isUserContextMenuCommand())
		command.execute(interaction);
	else
		throw new Error(`Command type mismatch: Command ${commandName} is of type ${command.type}, but interaction is of type ${interaction.commandType}.`);
}

interface DeployOptions { scope?: CommandScope }
interface GuildDeployOptions extends DeployOptions { guildId: string }

const deployToGuild = async ({ guildId, scope = CommandScopes.USER }: GuildDeployOptions) => {
	try {
		logger.await(`Refreshing ${scope} slash commands for guild with ID ${guildId} ...`);

		await rest.put(
			Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, guildId), { body: commandsData[scope] }
		);

		logger.success('Done!');
	} catch (error) {
		logger.error(error);
	}
}

const deployGlobally = async ({ scope = CommandScopes.USER }: DeployOptions = {}) => {
	try {
		logger.await(`Refreshing ${scope} global slash commands ...`);

		await rest.put(
			Routes.applicationCommands(config.DISCORD_CLIENT_ID), { body: commandsData[scope] }
		);

		logger.success('Done!');
	} catch (error) {
		logger.error(error);
	}
}
