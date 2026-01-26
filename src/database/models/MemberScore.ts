import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes } from "sequelize";
import { BelongsTo, Column, Index, Model, PrimaryKey, Table, Validate } from "sequelize-typescript";
import { Scoreboard } from "./Scoreboard";

@Table({
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

	rank?: CreationOptional<number>;

	@BelongsTo(() => Scoreboard, 'channelId')
	scoreboard?: Scoreboard;
}