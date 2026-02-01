import { DataTypes, InferAttributes, InferCreationAttributes, Sequelize } from 'sequelize';
import { BelongsTo, Column, Index, Model, PrimaryKey, Table, Validate } from 'sequelize-typescript';
import { Scoreboard } from './Scoreboard';

@Table({
	scopes: {
		ranked: {
			attributes: {
				include: [
					[Sequelize.literal('((SELECT COUNT(*) FROM MemberScores AS compare WHERE compare.channelId = MemberScore.channelId AND compare.score > MemberScore.score) + 1)'), 'rank']
				]
			}
		}
	},
	timestamps: false
})
export class MemberScore extends Model<InferAttributes<MemberScore>, InferCreationAttributes<MemberScore>> {
	@Index('channelId-memberId')
	@PrimaryKey
	@Column(DataTypes.STRING)
	declare channelId: string;

	@Index('channelId-memberId')
	@PrimaryKey
	@Column(DataTypes.STRING)
	declare memberId: string;

	@Validate({ min: 0 })
	@Column({ type: DataTypes.NUMBER, allowNull: false, defaultValue: 0 })
	declare score: number;

	rank?: number;

	@BelongsTo(() => Scoreboard, 'channelId')
	scoreboard?: Scoreboard;
}