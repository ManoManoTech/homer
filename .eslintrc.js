module.exports = {
  extends: [
    'airbnb-base',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  env: {
    es2020: true,
  },
  ignorePatterns: ['dist/**/*', 'node_modules/**/*'],
  overrides: [
    {
      files: '*.js',
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
  ],
  plugins: ['prettier', '@typescript-eslint'],
  rules: {
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-shadow': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { ignoreRestSiblings: true },
    ],
    '@typescript-eslint/no-use-before-define': [
      'error',
      { classes: false, functions: false, variables: true },
    ],
    'consistent-return': 'off',
    'func-names': 'error',
    camelcase: 0,
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
        groups: [
          'builtin', // Node.js internal modules
          'external', // npm dependencies
          'internal', // ~/module
          'parent', // ../module
          'sibling', // ./module
          'object', // import xx = console.log;
        ],
        'newlines-between': 'never',
        pathGroups: [
          {
            pattern: '@/**',
            group: 'internal',
          },
          {
            pattern: '@root/**',
            group: 'internal',
          },
        ],
      },
    ],
    'import/prefer-default-export': 'off',
    'lines-between-class-members': 'off',
    'no-await-in-loop': 'off',
    'no-console': 'error',
    'no-param-reassign': 'off',
    'no-restricted-syntax': 'off',
    'no-shadow': 'off',
    'no-use-before-define': 'off',
  },
  settings: {
    'import/resolver': {
      typescript: {},
    },
  },
};
