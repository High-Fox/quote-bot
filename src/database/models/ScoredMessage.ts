import { DataTypes, InferAttributes } from "sequelize";
import { BelongsTo, Column, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { Scoreboard } from "./Scoreboard";

type ScoredMessageCreationAttributes = {
	messageId: string;
	channelId: string;
	quotees: string[];
};

@Table({
	timestamps: false
})
export class ScoredMessage extends Model<InferAttributes<ScoredMessage, { omit: 'quoteesArray' }>, ScoredMessageCreationAttributes> {
	@Index
	@PrimaryKey
	@Column(DataTypes.STRING)
	declare messageId: string;

	@Column({ type: DataTypes.STRING, allowNull: false })
	declare channelId: string;

	@Column({ type: DataTypes.STRING, allowNull: false })
	get quotees(): string {
		return this.getDataValue('quotees');
	}

	set quotees(val: string | string[]) {
		if (Array.isArray(val))
			this.setDataValue('quotees', val.join(';'));
		else
			this.setDataValue('quotees', val);
	}

	get quoteesArray(): string[] {
		const value = this.getDataValue('quotees');
		return value.length ? value.split(';') : [];
	}

	@BelongsTo(() => Scoreboard, 'channelId')
	scoreboard?: Scoreboard;
}