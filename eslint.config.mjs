import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'jest.config.js'],
  },

  ...tseslint.configs.recommended,

  {
    files: ['**/*.{js,ts,tsx}'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      import: importPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.es2020,
      },
    },
    settings: {
      'import/resolver': {
        typescript: true,
        node: true,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true },
      ],
      '@typescript-eslint/no-use-before-define': [
        'error',
        { classes: false, functions: false, variables: true },
      ],

      'import/extensions': [
        'error',
        'ignorePackages',
        {
          js: 'never',
          ts: 'never',
          tsx: 'never',
        },
      ],
      'import/order': [
        'error',
        {
          alphabetize: { order: 'asc', caseInsensitive: false },
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'object',
          ],
          'newlines-between': 'never',
          pathGroups: [
            { pattern: '@/**', group: 'internal' },
            { pattern: '@root/**', group: 'internal' },
          ],
        },
      ],
      'import/prefer-default-export': 'off',

      'consistent-return': 'off',
      'func-names': 'error',
      camelcase: 'off',
      'lines-between-class-members': 'off',
      'no-await-in-loop': 'off',
      'no-console': 'error',
      'no-irregular-whitespace': 'off',
      'no-param-reassign': 'off',
      'no-restricted-syntax': 'off',
      'no-shadow': 'off',
      'no-use-before-define': 'off',
    },
  },

  {
    files: ['*.js'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
    },
  },
  {
    files: ['**/__mocks__/**/*', '**/__tests__/**/*'],
    rules: {
      '@typescript-eslint/no-empty-function': 'off',
      'class-methods-use-this': 'off',
      'max-classes-per-file': 'off',
      'no-await-in-loop': 'off',
      'no-useless-constructor': 'off',
    },
  },

  prettierConfig,
);
