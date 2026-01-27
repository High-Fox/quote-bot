import { ActionRowBuilder, DiscordjsTypeError, Embed, EmbedBuilder, GuildMessageManager, GuildTextBasedChannel, InteractionEditReplyOptions, Message, MessageManager, userMention, UserSelectMenuBuilder } from 'discord.js';
import { frequencyScore, getLogger, randomColor } from '../utils';
import { getAllQuotees } from './quote-handler';
import { Scoreboard, MemberScore } from '../database/models/';
import * as db from '../database';

const logger = getLogger('scoreboard-handler');
const RANK_TITLES = ['👑  **Quote Queen**', '🥈  **2nd Place**', '🥉  **3rd Place**'];
export const SCORE_USER_SELECT = 'scoreUserSelect';

const createEmbed = (leaders: MemberScore[], source?: Embed): EmbedBuilder => {
	const embed = source ? EmbedBuilder.from(source) : new EmbedBuilder()
		.setTitle('💬 Quotes Scoreboard')
		.setDescription('Lay out the red carpet for these weirdos:')
		.setFooter({ text: '✎' });
	embed.setColor(randomColor())
		.setTimestamp()
		.setFields(leaders.map((member, index) => ({
			name: RANK_TITLES[index],
			value: `${userMention(member.memberId)} – **${member.score}** quotes`,
			inline: true
		})));
	return embed;
}

export const setupScoreboard = async (channel: GuildTextBasedChannel, scoreboardMessage: Message<boolean>): Promise<InteractionEditReplyOptions> => {
	const messageQuotees = await getAllQuotees(channel);
	const quoteeScores = frequencyScore([...messageQuotees.values()].flat());
	const scoreboard = await db.createScoreboard({ channelId: channel.id, messageId: scoreboardMessage.id });

	await Promise.all([
		db.createMemberScores(scoreboard, [...quoteeScores.entries()].map(([memberId, score]) => ({ memberId, score }))),
		db.createScoredMessages(scoreboard, messageQuotees.map((quotees, messageId) => ({ messageId, quotees })))
	]);
	await scoreboard.reload();
	
	const topMembers = await getTopMembers(scoreboard);
	const actionRow = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
		new UserSelectMenuBuilder()
			.setCustomId(SCORE_USER_SELECT)
			.setPlaceholder('Get user\'s score')
	);
	return {
		content: '',
		embeds: [createEmbed(topMembers)],
		components: [actionRow]
	};
}

export const updateScoreboard = async (channelId: string, messages: MessageManager) => {
	const scoreboard = await db.getScoreboard(channelId);
	if (!scoreboard)
		return;

	const topMembers = await getTopMembers(scoreboard);
	try {
		await messages.fetch(scoreboard.messageId).then(message => {
			const embed = createEmbed(topMembers, message.embeds[0]);
			return message.edit({ embeds: [embed] });
		});
	} catch (error) {
		logger.error('Error updating scoreboard: %s.', error);
	}
}

export const removeScoreboard = async (scoreboard: Scoreboard, messages?: GuildMessageManager) => {
	try {
		if (messages)
			await messages.delete(scoreboard.messageId);
	} catch (error) {
		if (error instanceof DiscordjsTypeError)
			logger.error('Error fetching scoreboard message, probably already deleted.')
		else throw error;
	}
	return scoreboard.destroy();
}

const getTopMembers = async (scoreboard: Scoreboard) => {
	return scoreboard.$get('memberScores', {
		order: [['score', 'DESC']],
		limit: 3
	});
}