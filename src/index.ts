import { Client, Events, GatewayIntentBits, MessageFlags, Partials } from 'discord.js';
import { config } from './config';
import { getLogger } from './utils';
import { registerEventListeners, subscribe } from './handlers/event-handler';
import { registerCLICommand, startCLI } from './handlers/cli-handler';
import { handleChatCommand, handleContextMenuCommand } from './handlers/command-handler';
import './database';
import './handlers/quote-handler';

const logger = getLogger('main');
export const client = new Client({
	presence: {
		activities: [{
			name: '👀  Watching for quotes...',
			state: '...Always watching...'
		}]
	},
	intents: [
		GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent
	],
	partials: [Partials.Message]
});

registerCLICommand(['stop', 'exit'], 'Stops the process.', async function() {
	this.close();
	await client.destroy();
	return process.exit();
});

subscribe('once', Events.ClientReady, async (readyClient) => {
	logger.success('Logged in as %s', readyClient.user.tag);
	startCLI();
});

subscribe('on', Events.InteractionCreate, async (interaction) => {
	if (!interaction.inGuild())
		return;

	if (interaction.isCommand()) {
		try {
			if (interaction.isChatInputCommand())
				handleChatCommand(interaction);
			else if (interaction.isContextMenuCommand())
				handleContextMenuCommand(interaction);
		} catch (error) {
			logger.error(error);
			const content = 'An error occured while executing the command.';
			if (interaction.deferred || interaction.replied)
				interaction.editReply(content);
			else
				interaction.reply({ content, flags: MessageFlags.Ephemeral });
		}
	}
});

registerEventHandlers(client);

(async () => {
	logger.await('Logging in...');
	client.login(config.DISCORD_TOKEN);
})();
