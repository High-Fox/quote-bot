import { GuildTextBasedChannel, Message, GuildMemberManager, Events, Collection } from 'discord.js';
import { getChannelMessages, collapseText, StringNavigator, getLogger, frequencyScore } from '../utils';
import { subscribe } from './event-handler';
import { removeScoreboard, updateScoreboard } from './scoreboard-handler';
import * as db from '../database';

const logger = getLogger();
const MENTION_ID = /(?<=<@)\d{17,19}(?=>)/;
const MENTION_OR_ME = /<@\d{17,19}>|(?<!\*)\bMe\b/i;
const UNTIL_MENTION_OR_ME = new RegExp('[-,\\s]+(?=' + MENTION_OR_ME.source + ')', 'i');
const QUOTES = /["“”].+?["“”]/gs;
// Tuple consisting of a quote and quotee user IDs
export type QuoteTuple = [string, string[]];

subscribe('on', Events.MessageCreate, async (message) => {
	if (message.partial)
		message = await message.fetch();
	const scoreboard = await db.getScoreboard(message.channelId);
	if (!scoreboard || !message.inGuild() || message.author.bot)
		return;
	const quotees = await resolveQuotees(message);
	if (!quotees.length)
		return;

	await Promise.all([
		db.createScoredMessage(scoreboard, { messageId: message.id, quotees }),
		db.incrementMemberScores(scoreboard, frequencyScore(quotees))
	]);
	updateScoreboard(message.channelId, message.channel.messages);
});

subscribe('on', Events.MessageUpdate, async (oldMessage, message) => {
	if (message.partial)
		message = await message.fetch();
	const scoreboard = await db.getScoreboard(message.channelId);
	if (!scoreboard || !message.inGuild() || message.author.bot)
		return;
	const previousMessageScore = await db.getScoredMessage(message.id);

	const oldQuotees = previousMessageScore ? previousMessageScore.quoteesArray : [];
	const oldQuoteesMap = frequencyScore(oldQuotees);
	const newQuotees = await resolveQuotees(message);
	const newQuoteesMap = frequencyScore(newQuotees);
	if (oldQuoteesMap.size === newQuoteesMap.size) {
		if (!oldQuoteesMap.size || [...newQuoteesMap.entries()].every(([key, value]) => oldQuoteesMap.has(key) && oldQuoteesMap.get(key) === value))
			return;
	}

	await db.decrementMemberScores(scoreboard, oldQuoteesMap);
	await db.incrementMemberScores(scoreboard, newQuoteesMap);

	if (previousMessageScore) {
		if (!newQuotees.length)
			db.removeScoredMessage(previousMessageScore);
		else {
			previousMessageScore.quotees = newQuotees;
			previousMessageScore.save();
		}
	} else
		db.createScoredMessage(scoreboard, { messageId: message.id, quotees: newQuotees });
	
	updateScoreboard(message.channelId, message.channel.messages);
});

subscribe('on', Events.MessageDelete, async (message) => {
	const scoreboard = await db.getScoreboard(message.channelId);
	if (!scoreboard)
		return;
	const previousScore = await db.getScoredMessage(message.id);
	if (!previousScore)
		return;

	const oldQuotees = frequencyScore(previousScore.quoteesArray);
	await Promise.all([
		db.decrementMemberScores(scoreboard, oldQuotees),
		db.removeScoredMessage(previousScore)
	]);
	updateScoreboard(message.channelId, message.channel.messages);
});

subscribe('on', Events.ChannelDelete, async (channel) => {
	const scoreboard = await db.getScoreboard(channel.id);
	if (!scoreboard)
		return;
	removeScoreboard(scoreboard);
});

/**
 * Convenience method calling {@link extractQuotees} on every message in a guild channel.
 * @returns A mapping of message IDs to arrays of quotees
 */
export const getAllQuotees = async (channel: GuildTextBasedChannel): Promise<Collection<string, string[]>> => {
	const quotees = new Collection<string, string[]>();
	const messages = await getChannelMessages(channel);

	await Promise.all(messages.map((message, id) => {
		if (!QUOTES.test(collapseText(message.content)) || message.author.bot)
			return;
		return resolveQuotees(message)
			.then(results => {
				if (results.length)
					quotees.set(id, results);
			});
	}));
	return quotees;
}

export const splitAtQuotes = (text: string): string[] => {
	const sections: string[] = [];
	const quoteIndexes = (text.match(QUOTES) ?? []).map(match => text.indexOf(match));

	for (const index of quoteIndexes)
		sections.push(text.substring(index, quoteIndexes[quoteIndexes.indexOf(index) + 1]));

	return sections;
}

/**
 * Extracts any quotes found in a message object and resolves the assigned quotees to their
 * respective user IDs.
 * @returns An array of tuples, each containing a quote and an array of the user IDs assigned to it (allowing duplicates)
 */
export const resolveQuoteTuples = async ({ content, guild, author }: Message<true>): Promise<QuoteTuple[]> => {
	return Promise.all(
		splitAtQuotes(content).map(quote => Promise.all(
			extractQuotees(quote).map(quotee => resolveMemberId(quotee, guild.members, author.id))
		).then(quotees => ([quote.match(QUOTES)![0], quotees.filter(quotee => quotee != null)]) as QuoteTuple))
	).then(results => results.filter(([, quotees]) => quotees.length));
}

/**
 * Resolves the quotees found in a message object to their respective user IDs.
 * @returns An array of user IDs (allowing duplicates)
 */
const resolveQuotees = async ({ content, guild, author }: Message<true>): Promise<string[]> => {
	const quotees = extractQuotees(content);

	return Promise.all(quotees.map(quotee => resolveMemberId(quotee, guild.members, author.id)))
		.then(results => results.filter(quotee => quotee !== null));
}

/**
 * Extracts any quotees assigned AFTER any quotes within a string.
 * @returns An array of quotee names (allowing duplicates)
 */
export const extractQuotees = (text: string): string[] => {
	const inlinedText = collapseText(text);
	const quotees: string[] = [];

	for (const context of splitAtQuotes(inlinedText)) {
		const navigator = new StringNavigator(context);

		navigator.moveIf(QUOTES);
		if (navigator.moveUntil(MENTION_OR_ME)) {
			const mention = navigator.take(MENTION_OR_ME);
			if (mention)
				quotees.push(mention);
			
			while (navigator.moveIf(UNTIL_MENTION_OR_ME)) {
				const nextMention = navigator.take(MENTION_OR_ME);
				if (nextMention)
					quotees.push(nextMention);
			}
		}
	}
	return quotees;
}

/**
 * Resolve a Discord member id from freeform text.
 * Resolvable inputs include `<@123456789>`, `Username`, `Usern`, `Me (author reference)`.
 */
export const resolveMemberId = async (text: string, guildMembers?: GuildMemberManager, sender?: string) => {
	text = text.trim();
	const mentionMatch = text.match(MENTION_ID);
	if (mentionMatch)
		return mentionMatch[0];
	const nameMatch = text.match(/\w+/);

	if (nameMatch) {
		if (sender && nameMatch[0].trim().toLowerCase() === 'me')
			return sender;
		if (guildMembers) {
			return guildMembers.search({ query: nameMatch[0] })
				// Todo: ask for clarification if multiple members are matched (unless scoring entire channel)
				.then(members => members.size === 1 ? members.first()!.id : null)
				.catch(error => {
					logger.error(error);
					return null;
				});
		}
	}
	return null;
}
