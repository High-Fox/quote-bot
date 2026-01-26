import { ClientEvents, Client } from 'discord.js';
import { getLogger } from '../utils';

const logger = getLogger();
type EventListener<Event extends keyof ClientEvents> = (...args: ClientEvents[Event]) => void;
type ListenerType = 'on' | 'once';
const eventHandlers: {
	[Event in keyof ClientEvents]?: Partial<Record<ListenerType, EventListener<Event>[]>>
} = {};

export const subscribe = <Event extends keyof ClientEvents>(type: ListenerType, event: Event, listener: EventListener<Event>) => {
	if (!eventHandlers[event])
		eventHandlers[event] = {};
	if (!eventHandlers[event][type])
		eventHandlers[event][type] = [];
	eventHandlers[event][type].push(listener);
}

export const registerEventHandlers = (client: Client) => {
	let totalCount = 0;
	for (const [event, { on = [], once = [] }] of Object.entries(eventHandlers)) {
		totalCount += on.length + once.length;
		for (const handler of on)
			client.on(event, handler);
		for (const handler of once)
			client.once(event, handler);
	}
	logger.complete('Registered %d event handlers.', totalCount);
}
