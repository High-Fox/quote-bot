import { Client, Events, GatewayIntentBits, MessageFlags, Partials } from 'discord.js';
import { config } from './config';
import { getLogger } from './utils';
import { registerEventHandlers, subscribe } from './handlers/event-handler';
import './database';
import { handleChatCommand, handleContextMenuCommand } from './handlers/command-handler';
import './handlers/quote-handler';

const logger = getLogger('main');
export const client = new Client({
	presence: {
		activities: [{
			name: '👀  Watching for quotes...',
			state: '...Always watching...'
		}]
	},
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
	partials: [Partials.Message]
});

subscribe('once', Events.ClientReady, async (readyClient) => {
	logger.success('Logged in as %s', readyClient.user.tag);
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
			const reply = 'An error occured while executing the command.';
			if (interaction.deferred || interaction.replied)
				interaction.editReply(reply);
			else
				interaction.reply({ content: reply, flags: MessageFlags.Ephemeral });
		}
	}
});

registerEventHandlers(client);

(async () => {
	logger.await('Logging in...');
	client.login(config.DISCORD_TOKEN);
})();
