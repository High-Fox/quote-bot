import { ClientEvents, Client } from 'discord.js';
import { getLogger } from '../utils';

const logger = getLogger('event-handler');
type EventListener<Event extends keyof ClientEvents> = (...args: ClientEvents[Event]) => void;
type ListenerType = 'on' | 'once';
const eventListeners: {
	[Event in keyof ClientEvents]?: Partial<Record<ListenerType, EventListener<Event>[]>>
} = {};

export const subscribe = <Event extends keyof ClientEvents>(type: ListenerType, event: Event, listener: EventListener<Event>) => {
	eventListeners[event] ??= {};
	eventListeners[event][type] ??= [];
	eventListeners[event][type].push(listener);
}

export const registerEventListeners = (client: Client) => {
	let totalCount = 0;
	for (const [event, { on = [], once = [] }] of Object.entries(eventListeners)) {
		totalCount += on.length + once.length;
		for (const listener of on)
			client.on(event, listener);
		for (const listener of once)
			client.once(event, listener);
	}
	logger.complete('Registered %d event listeners.', totalCount);
}
