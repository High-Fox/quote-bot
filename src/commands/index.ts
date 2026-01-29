import { ApplicationCommandType, ChatInputCommandInteraction, CommandInteraction, ContextMenuCommandBuilder, MessageContextMenuCommandInteraction, RESTPostAPIBaseApplicationCommandsJSONBody, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder, UserContextMenuCommandInteraction } from 'discord.js';
import { scoreboard } from './scoreboard';
import { test } from './dev/test';
import { score } from './score';
import { guess } from './guess';
import { check } from './check';

type CommandFunction<T extends CommandInteraction<'raw' | 'cached'>> = (interaction: T) => Promise<unknown>;
interface SerializableCommand<Data extends { toJSON(): RESTPostAPIBaseApplicationCommandsJSONBody }> {
	type: ApplicationCommandType,
	data: Data
};
export interface BasicCommand extends SerializableCommand<SlashCommandOptionsOnlyBuilder> {
	type: ApplicationCommandType.ChatInput,
    execute: CommandFunction<ChatInputCommandInteraction<'raw' | 'cached'>>
};
export interface SubcommandsCommand extends SerializableCommand<SlashCommandSubcommandsOnlyBuilder> {
	type: ApplicationCommandType.ChatInput,
	execute: { [subcommand: string]: CommandFunction<ChatInputCommandInteraction<'raw' | 'cached'>> }
};
export interface MessageContextMenuCommand extends SerializableCommand<ContextMenuCommandBuilder> {
	type: ApplicationCommandType.Message,
	execute: CommandFunction<MessageContextMenuCommandInteraction<'raw' | 'cached'>>
};
export interface UserContextMenuCommand extends SerializableCommand<ContextMenuCommandBuilder> {
	type: ApplicationCommandType.User
	execute: CommandFunction<UserContextMenuCommandInteraction<'raw' | 'cached'>>
};

export type ChatCommand = BasicCommand | SubcommandsCommand;
export type ContextMenuCommand = MessageContextMenuCommand | UserContextMenuCommand;
export type Command = ChatCommand | ContextMenuCommand;

const commands = { scoreboard, score, guess, check };
const devCommands = { test };

export enum CommandScopes {
	USER = 'USER',
	DEV = 'DEV',
	ALL = 'ALL'
};
export type CommandScope = keyof typeof CommandScopes;
export const Commands: Record<CommandScope, Record<string, Command>> = {
	[CommandScopes.USER]: { ...commands },
	[CommandScopes.DEV]: { ...devCommands },
	[CommandScopes.ALL]: { ...commands, ...devCommands }
} as const;
export type CommandSet = typeof Commands[CommandScope];