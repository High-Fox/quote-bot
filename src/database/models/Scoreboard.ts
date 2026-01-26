import { DataTypes, InferAttributes, InferCreationAttributes } from "sequelize";
import { Column, HasMany, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { MemberScore } from "./MemberScore";
import { ScoredMessage } from "./ScoredMessage";

@Table({
	timestamps: false
})
export class Scoreboard extends Model<InferAttributes<Scoreboard>, InferCreationAttributes<Scoreboard>> {
	@Index
	@PrimaryKey
	@Column(DataTypes.STRING)
	declare channelId: string;

	@Column({ type: DataTypes.STRING, allowNull: false })
	declare messageId: string;

	@HasMany(() => MemberScore, 'channelId')
	memberScores?: MemberScore[];

	@HasMany(() => ScoredMessage, 'channelId')
	scoredMessages?: ScoredMessage[];
}