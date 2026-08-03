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
  prettier
);
