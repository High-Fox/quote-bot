import { Attributes } from 'sequelize';
import { Model, Sequelize } from 'sequelize-typescript';
import { getLogger } from '../utils';
import { Scoreboard, MemberScore, ScoredMessage } from './models/';

const logger = getLogger('database');
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
type ModelAttributes<T extends Model> = Pick<T, RequiredAttributes<Attributes<T>>>;
type CreationAttributes<T extends Model> = T extends Model<infer A, infer B> ? B : never;

export const hasScoreboard = (channelId: string) => {
	return Scoreboard.count({
		where: {
			channelId: channelId
		}
	}).then(count => count > 0);
}

export const getScoreboard = (channelId: string) => {
	return Scoreboard.findByPk(channelId);
}

export const createScoreboard = (options: ModelAttributes<Scoreboard>) => {
	return Scoreboard.create(options);
}

export const getMemberScore = (scoreboard: Scoreboard, memberId: string) => {
	return scoreboard.$get('memberScores', {
		scope: 'ranked',
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
				return memberScore?.increment('score', { by: amount }) ?? createMemberScore(scoreboard, { memberId, score: amount });
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

export const createMemberScore = (scoreboard: Scoreboard, options: Omit<ModelAttributes<MemberScore>, 'channelId'>) => {
	return scoreboard.$create<MemberScore>(MemberScore.name, options);
}

export const createMemberScores = (
	scoreboard: Scoreboard,
	optionsArray: Omit<ModelAttributes<MemberScore>, 'channelId'>[]
) => {
	return MemberScore.bulkCreate(optionsArray.map(options => ({
		channelId: scoreboard.channelId,
		...options
	})));
}

export const getScoredMessage = (messageId: string) => {
	return ScoredMessage.findByPk(messageId);
}

export const createScoredMessage = (scoreboard: Scoreboard, options: Omit<CreationAttributes<ScoredMessage>, 'channelId'>) => {
	return scoreboard.$create<ScoredMessage>(ScoredMessage.name, options);
}

export const createScoredMessages = (
	scoreboard: Scoreboard,
	optionsArray: Omit<CreationAttributes<ScoredMessage>, 'channelId'>[]
) => {
	return ScoredMessage.bulkCreate(optionsArray.map(options => ({
		channelId: scoreboard.channelId,
		...options
	})));
}