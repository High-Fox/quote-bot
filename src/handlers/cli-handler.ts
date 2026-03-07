import { getLogger } from '../utils';
import { stdin, stdout } from 'node:process';
import { createInterface, Interface } from 'node:readline';

const logger = getLogger('cli');
type CLICommandHandler = (this: Interface, ...args: string[]) => Promise<unknown> | unknown;
interface CLICommand {
	names: string[],
	description: string,
	args: string[],
	handler: CLICommandHandler
};
const cliCommands: Record<string, CLICommand> = {};
const aliasLookup: Record<string, string> = {};

// Taken from https://www.geeksforgeeks.org/javascript/how-to-get-the-javascript-function-parameter-names-values-dynamically/
const getArgNames = (func: Function) => {
	let str = func.toString();
	str = str.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/\/\/(.)*/g, '')
		.replace(/{[\s\S]*}/, '')
		.replace(/=>/g, '')
		.trim();

	const start = str.indexOf('(')  + 1;
	const end = str.length - 1;
	const result = str.substring(start, end).split(', ');
	const args: string[] = [];

	result.forEach(element => {
		element = element.replace(/=[\s\S]*/g, '').trim();
		if (element.length > 0)
			args.push(element);
	});

	return args;
}

export const registerCLICommand = (names: [string, ...string[]], description: string, handler: CLICommandHandler) => {
	const name = names[0];
	if (cliCommands[name])
		throw new Error(`Attempted to register duplicate CLI command '${name}'.`);

	for (const alias of names.slice(1)) {
		if (aliasLookup[alias])
			throw new Error(`Attempted to register duplicate alias '${alias}'.`);
		aliasLookup[alias] = name;
	}
	const args = getArgNames(handler);

	cliCommands[name] = { names, description, args, handler };
}

registerCLICommand(['help'], 'Displays this message.', () => {
	for (const { names, description, args } of Object.values(cliCommands))
		logger.log(`${names.join('/')} ${args.map((argName) => `[${argName}]`).join(' ')} - ${description}`);
});

export const startCLI = () => {
	const interf = createInterface({
		input: stdin,
		output: stdout
	});
	
	logger.log('Type \'help\' for list of commands.');

	interf.prompt();
	interf.on('line', async (input) => {
		interf.pause();
		if (!input.trim().length)
			return interf.prompt();

		const { commandName, args } = parseCommand(input);
		const command = cliCommands[commandName] || cliCommands[aliasLookup[commandName]];
		if (!command) {
			logger.log(`Unknown command '${commandName}'.`);
			return interf.prompt();
		}

		const { args: requiredArgs, handler } = command;
		if (requiredArgs.length > args.length) {
			const missingArgs = requiredArgs.slice(args.length);
			logger.log(`Missing arguments: ${missingArgs.join(', ')}.`);
			return interf.prompt();
		}

		await handler.call(interf, ...args);
		return interf.prompt();
	});
}

const parseCommand = (input: string) => {
	const splitInput = input.trim().split(' ');
	return {
		commandName: splitInput[0],
		args: splitInput.slice(1)
	}
}