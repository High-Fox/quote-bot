import { ApplicationCommandType, ChatInputCommandInteraction, ContextMenuCommandInteraction, Events, InteractionContextType, REST, Routes } from 'discord.js';
import { typeFlag } from 'type-flag';
import { config } from '../config';
import { ChatCommand, Commands, CommandScopes, CommandScope, SubcommandsCommand, CommandSet } from '../commands';
import { getLogger } from '../utils';
import { subscribe } from './event-handler';

const logger = getLogger('command-handler');
const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);
const commandsData = () => Object.fromEntries(
	Object.entries(Commands).map(([key, commands]) => {
		const data = Object.values(commands).map(command => command.data.setContexts(InteractionContextType.Guild).toJSON());
		return [key, data];
	})
);

const getCommandsFor = (guildId: string): CommandSet => {
	return guildId === config.DEV_GUILD_ID ? Commands.ALL : Commands.USER;
}

const hasSubcommands = (command: ChatCommand): command is SubcommandsCommand => {
	return typeof command.execute !== 'function';
}

subscribe('once', Events.ClientReady, async () => {
	const deployScopes = ['dev', 'global'] as const;
	const { flags } = typeFlag({
		deployCommands: [(scope: typeof deployScopes[number]) => {
			if (!deployScopes.includes(scope))
				throw new Error(`Invalid value for deployCommands flag: '${scope}'`);
			return scope;
		}]
	});
	
	if (flags.deployCommands.includes('dev'))
		await deployToGuild({ guildId: config.DEV_GUILD_ID, scope: CommandScopes.DEV});
	if (flags.deployCommands.includes('global'))
		await deployGlobally();
});

export const handleChatCommand = async (interaction: ChatInputCommandInteraction<'raw' | 'cached'>) => {
	const { commandName, options, guildId } = interaction;
	const commands = getCommandsFor(guildId);
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
	const { commandName, guildId } = interaction;
	const commands = getCommandsFor(guildId);
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

interface DeployOptions { scope: CommandScope }
interface GuildDeployOptions extends DeployOptions { guildId: string }

const deployToGuild = async ({ guildId, scope }: GuildDeployOptions) => {
	try {
		await rest.put(
			Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, guildId), { body: commandsData()[scope] }
		);

		logger.success(`Updated ${scope} slash commands for guild with ID ${guildId}.`);
	} catch (error) {
		logger.error(error);
	}
}

const deployGlobally = async ({ scope }: DeployOptions = { scope: CommandScopes.USER }) => {
	try {
		await rest.put(
			Routes.applicationCommands(config.DISCORD_CLIENT_ID), { body: commandsData()[scope] }
		);

		logger.success(`Updated ${scope} global slash commands.`);
	} catch (error) {
		logger.error(error);
	}
}
