// @ts-check

import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	{
		languageOptions: {
			parserOptions: {
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			curly: ['error', 'multi-or-nest'],
			indent: [
				'error', 'tab',
				{
					'ignoredNodes': [
						'FunctionExpression > .params[decorators.length > 0]',
						'FunctionExpression > .params > :matches(Decorator, :not(:first-child))',
						'ClassBody.body > PropertyDefinition[decorators.length > 0] > .key'
					],
					'SwitchCase': 1,
					'VariableDeclarator': 1
				}
			],
			'no-unused-vars': 'off',
			'no-unused-private-class-members': 'warn',
			'@typescript-eslint/no-unused-vars': 'warn'
		}
	},
	{
		ignores: ['dist/']
	}
);
