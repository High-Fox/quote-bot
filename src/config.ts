import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DEV_GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID || !DEV_GUILD_ID) 
	throw new Error('Missing environment variables!');

export const config = {
	DISCORD_TOKEN,
	DISCORD_CLIENT_ID,
	DEV_GUILD_ID
};
