import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import storybook from 'eslint-plugin-storybook';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    /*
        examples/ is a standalone app on the published package, not part
        of the library build — it has its own tsconfig and dependencies.
     */
    ignores: [
      'dist',
      'storybook-static',
      'coverage',
      'playwright-report',
      'examples'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // configs['recommended-latest'] is still the legacy shape in v7; flat.* is not.
  reactHooks.configs.flat.recommended,
  ...storybook.configs['flat/recommended'],
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      'no-console': 'warn',
      // Table-driven tests carry a trailing note column that is documentation.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ]
    }
  },
  {
    /*
        Build scripts run in Node, not a browser. Without this the config only
        declares globals for .ts and .tsx, so `console` in a build script reads
        as undefined.
     */
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' }
  },
  /*
      Complexity, measured rather than assumed.

      Before 1.0.0 nothing watched this, and two functions had quietly reached
      a cyclomatic complexity of 21. The tangled parts were split out; what is
      left is structural, and listed as exceptions below rather than pretended
      away.

      The threshold exists to stop anything *new* getting there. Raising it is
      a decision someone has to make on purpose.
   */
  {
    files: ['lib/**/*.ts'],
    ignores: ['**/*.test.ts', '**/*.stories.*'],
    rules: { complexity: ['error', 12] }
  },
  {
    /*
        reduceInput is a flat switch over sixteen input types. The metric counts
        every case, but a dispatch table is the clearest shape this can take —
        collapsing it to satisfy a number would make it worse to read.

        isValidInsert is a chain of independent guard clauses, each rejecting
        one rule. Same argument: the count is high, the reading is linear.
     */
    files: [
      'lib/components/financialInput/financialInputReducer.ts',
      'lib/components/financialInput/financialInputUtils.ts'
    ],
    rules: { complexity: ['error', 18] }
  },
  {
    /*
        A hook body, whose branches are spread across many small closures
        rather than nested in one. Extracting them further would mean passing
        the same eight values through every signature.
     */
    files: ['lib/components/financialInput/useFinancialInput.ts'],
    rules: { complexity: ['error', 22] }
  },
  prettier
);
