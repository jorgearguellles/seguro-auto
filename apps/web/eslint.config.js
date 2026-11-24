// @ts-check
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
  {
    ignores: ['dist/', 'node_modules/', '*.js'],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // Prohibit any (CLAUDE.md §2)
      '@typescript-eslint/no-explicit-any': 'error',

      // No console.log (use logStructured)
      'no-console': ['error', { allow: ['warn', 'error'] }],

      // Security: prohibit Strapi token patterns (ADR-003 D3)
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/STRAPI_TOKEN/]',
          message: 'No Strapi tokens allowed in apps/web (ADR-003).',
        },
        {
          selector: 'Literal[value=/populate=\\*/]',
          message: 'populate=* is forbidden (ADR-003 D4). Use explicit populate.',
        },
      ],

      // No NgModules (CLAUDE.md §2) — no direct enforceable rule but naming convention
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
