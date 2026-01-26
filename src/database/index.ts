import { Attributes } from 'sequelize';
import { Model, Sequelize } from 'sequelize-typescript';
import { getLogger } from '../utils';
import { Scoreboard, MemberScore, ScoredMessage } from './models/';

const logger = getLogger();
export const connection = new Sequelize({
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	storage: 'database.sqlite',
	models: [Scoreboard, MemberScore, ScoredMessage]
});

// only reason this isnt in a ClientReady handler is because it delayed the log message
// and upset the delicate aesthetics of my startup sequence logging order
await connection.sync()
	.then(() => logger.complete('Database synced!'))
	.catch(logger.error);

type RequiredAttributes<T extends Model> = Exclude<Exclude<keyof T, keyof Model>, keyof {
	[Key in keyof T as T[Key] extends Required<T>[Key] ? never : Key]: T[Key]
}>;
type ModelAttributes<T extends Model, Options extends { omit?: keyof Attributes<T> } = { omit: never }> = 
	Pick<T, Exclude<RequiredAttributes<Attributes<T>>, Options['omit']>>;

export const getScoreboard = (channelId: string) => {
	return Scoreboard.findByPk(channelId);
}

export const createScoreboard = (options: ModelAttributes<Scoreboard>) => {
	return Scoreboard.create(options);
}

export const getMemberScore = (scoreboard: Scoreboard, memberId: string) => {
	return scoreboard.$get('memberScores', {
		attributes: {
			include: [
				[Sequelize.literal('((SELECT COUNT(*) FROM MemberScores AS compareScore WHERE compareScore.score > MemberScore.score) + 1)'), 'rank']
			]
		},
		where: {
			memberId: memberId
		},
		limit: 1
	}).then(results => results.length === 1 ? results[0] : null);
}

export const incrementMemberScores = (scoreboard: Scoreboard, memberScores: Map<string, number>) => {
	return Promise.all([...memberScores.entries()].map(([memberId, amount]) => {
		return getMemberScore(scoreboard, memberId)
			.then(memberScore => {
				return memberScore ? memberScore.increment('score', { by: amount }) : createMemberScore(scoreboard, { memberId, score: amount });
			});
	}));
}

export const decrementMemberScores = (scoreboard: Scoreboard, memberScores: Map<string, number>) => {
	return Promise.all([...memberScores.entries()].map(([memberId, amount]) => {
		return getMemberScore(scoreboard, memberId)
			.then(memberScore => {
				if (memberScore) {
					return memberScore.decrement('score', {
						by: memberScore.score - amount < 0 ? amount - (amount - memberScore.score) : amount
					});
				}
				// decrementing someone implies they have a score so... do nothing if not?
			});
	}));
}

export const createMemberScore = (scoreboard: Scoreboard, options: ModelAttributes<MemberScore, { omit: 'channelId' }>) => {
	return scoreboard.$create<MemberScore>(MemberScore.name, options);
}

export const createMemberScores = (
	scoreboard: Scoreboard,
	optionsArray: ModelAttributes<MemberScore, { omit: 'channelId' }>[]
) => {
	return MemberScore.bulkCreate(optionsArray.map(options => ({
		channelId: scoreboard.channelId,
		...options
	})));
}

export const getScoredMessage = (messageId: string) => {
	return ScoredMessage.findByPk(messageId);
}

export const createScoredMessage = (
	scoreboard: Scoreboard,
	options: ModelAttributes<ScoredMessage, { omit: 'channelId' | 'quotees' }> & { quotees: string[] }
) => {
	return scoreboard.$create<ScoredMessage>(ScoredMessage.name, options);
}

export const createScoredMessages = (
	scoreboard: Scoreboard,
	optionsArray: (ModelAttributes<ScoredMessage, { omit: 'channelId' | 'quotees' }> & { quotees: string[] })[]
) => {
	return ScoredMessage.bulkCreate(optionsArray.map(options => ({
		channelId: scoreboard.channelId,
		...options
	})));
}

export const removeScoredMessage = (scoredMessage: ScoredMessage) => {
	return scoredMessage.destroy();
}