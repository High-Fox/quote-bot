// @ts-check

import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
	globalIgnores(['dist/']),
	{
		extends: [eslint.configs.recommended],

		rules: {
			curly: ['error', 'multi-or-nest'],
			quotes: ['error', 'single']
		}
	},
	{
		files: ['**/*.ts'],
		extends: [tseslint.configs.stylisticTypeChecked],

		languageOptions: {
			parserOptions: {
				tsconfigRootDir: import.meta.dirname,
				projectService: true
			},
		},
		rules: {
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
			'@typescript-eslint/no-unused-vars': 'warn'
		}
	}
);
