import { Collection, Colors, ContainerBuilder, GuildTextBasedChannel, Message, TextBasedChannel } from 'discord.js'
import signale from 'signale';
import { getCallSites } from 'node:util';
import { parse as parsePath } from 'node:path';

const _defaultSignaleOptions: signale.SignaleOptions = {
	types: {
		debug: {
			badge: '👾',
			label: 'debug',
			color: 'magenta',
			logLevel: 'debug'
		},
		complete: {
			badge: '✔',
			label: 'complete',
			color: 'cyanBright',
			logLevel: 'info'
		}
	}
}
export const getLogger = (...scope: string[]) => {
	const logger = new signale.Signale({ ..._defaultSignaleOptions });
	if (!scope.length) {
		const callerFile = parsePath(getCallSites()[1].scriptName);
		const callerName = callerFile.name === 'index' ? callerFile.dir.split('/').at(-1)! : callerFile.name;
		return logger.scope(callerName);
	}
	return logger.scope(...scope);
}
const logger = getLogger();

export const containerBase = (color?: keyof typeof Colors) => {
	return new ContainerBuilder()
		.setAccentColor(color ? Colors[color] : randomColor());
}

export const randomColor = () => {
	return Math.floor(Math.random() * (0xFFFFFF + 1));
}

/**
 * Appends the appropriate suffix (th, st, nd, or rd) to a number.
 */
export const ordinalSuffix = (num: number) => {
	const suffix = ['th', 'st', 'nd', 'rd'];
	const div100 = num % 100;
	return num + (suffix[(div100 - 20) % 10] || suffix[div100] || suffix[0]);
}

/**
 * Maps each unique array element to how many occurances it has.
 */
export const frequencyScore = <Type>(input: Type[]): Map<Type, number> => {
	const map = new Map<Type, number>();
	for (const element of input)
		map.set(element, (map.get(element) ?? 0) + 1);
	return map;
}

export const collapseText = (text: string) => {
	return text
		.replace(/[\s\xa0]+/g, ' ')
		.replace(/^\s+|\s+$/g, '');
	// add more replacements as needed
}

export const getChannelMessages = async <
	Channel extends TextBasedChannel, InGuild extends boolean = Channel extends GuildTextBasedChannel ? true : false
>(channel: Channel): Promise<Collection<string, Message<InGuild>>> => {
	const channelMessages = new Collection<string, Message<InGuild>>();
	let messagesPointer = await channel.messages.fetch({ limit: 1 })
		.then(messages => {
			const message = messages.size === 1 ? messages.first() : null;
			// include the initial message
			if (message)
				channelMessages.set(message.id, message as Message<InGuild>);
			return message;
		})
		.catch(logger.error);

	while (messagesPointer) {
		// is 100 messages too big of a processing chunk? fafo i guess
		await channel.messages.fetch({ limit: 100, before: messagesPointer.id })
			.then(messages => {
				messagesPointer = messages.size > 0 ? messages.at(-1) : null;
				for (const [id, message] of messages)
					channelMessages.set(id, message as Message<InGuild>);
			})
			.catch(logger.error);
	}
	return channelMessages;
}

export class StringNavigator {
	private text: string;
	private cursorPos: number;
	private history: string[];

	constructor(text: string) {
		this.text = text;
		this.cursorPos = 0;
		this.history = [];
	}

	/**
	 * Returns the substring from the current cursor position up to the end of the string,
	 * the given amount of characters or matching the given RegExp.
	 */
	peek(limit?: number | RegExp): string {
		if (limit instanceof RegExp) {
			const match = this.peek().match(limit);
			if (match?.index === 0)
				return match[0];
			else return '';
		}
		return this.text.substring(this.cursorPos, limit);
	}

	private move(length: number): void {
		if (length > 0)
			this.history.push(this.text.substring(this.cursorPos, Math.min(this.cursorPos + length, this.text.length)));
		this.cursorPos += length;
	}

	/**
	 * Moves the cursor forward IF the given string or RegExp is found at the current position.
	 */
	moveIf(input: string | RegExp): boolean {
		if (input instanceof RegExp) {
			const match = this.peek().match(input);
			if (match && this.peek().indexOf(match[0]) === 0) {
				this.move(match[0].length);
				return true;
			}
		} else if (this.peek().startsWith(input)) {
			this.move(input.length);
			return true;
		}
		return false;
	}

	/**
	 * Moves the cursor forward until the given string or RegExp is found.
	 */
	moveUntil(input: string | RegExp): boolean {
		const index = input instanceof RegExp ? this.peek().search(input) : this.peek().indexOf(input);
		if (index !== -1) {
			this.move(index);
			return true;
		}
		return false;
	}

	/**
	 * Handy combination of `moveUntil` and `moveIf`.
	 */
	moveAfter(input: string | RegExp): boolean {
		return this.moveUntil(input) && this.moveIf(input);
	}

	/**
	 * Moves past and returns the first segment of text matching the given RegExp
	 * that starts at the current cursor position.
	 */
	take(input: RegExp): string {
		const match = this.peek(input);
		if (match.length)
			this.moveIf(match);
		return match;
	}

	/**
	 * Reverts the last forward move operation, restoring the cursor to its previous position.
	 */
	back(): this {
		const lastMove = this.history.pop();
		if (lastMove)
			this.cursorPos -= lastMove.length;
		return this;
	}

	/**
	 * Creates an iterable that yields each sequential character from the current cursor position
	 * to the end of the string. Does not modify the cursor position.
	 */
	iterate(): Iterable<string> {
		const source = this.peek();
		let pos = 0;
		return {
			[Symbol.iterator]() {
				return {
					next(): IteratorResult<string> {
						if (pos < source.length) {
							const char = source.charAt(pos++);
							return { value: char, done: false };
						}
						return { value: undefined, done: true };
					}
				}
			}
		}
	}
}