/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const rootDir = import.meta.dirname;

export default defineConfig({
  plugins: [react()],
  build: {
    copyPublicDir: false,
    sourcemap: true,
    lib: {
      /*
          Three entries, so that currency data and event reading are not
          measured as part of importing the input. Shared code between them
          becomes a chunk rather than being duplicated.
       */
      entry: {
        index: resolve(rootDir, 'lib/index.ts'),
        parse: resolve(rootDir, 'lib/parse.ts'),
        currency: resolve(rootDir, 'lib/currency.ts'),
        events: resolve(rootDir, 'lib/events.ts')
      },
      formats: ['es', 'cjs'],
      fileName: (format, name) => `${name}.${format === 'es' ? 'js' : 'cjs'}`
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        /*
            'use client' goes only on the entry that contains React.

            A module carrying the directive has every export turned into a
            client reference by the Next.js App Router, so putting it on the
            pure entries made `parseAmount` unusable in a server action — which
            the documentation had been promising worked. `parse`, `currency`
            and `events` import no React at all, so they stay server-callable.
         */
        banner: (chunk) =>
          chunk.isEntry && chunk.name === 'index' ? "'use client';" : ''
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['lib/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.{ts,tsx}'],
      exclude: [
        'lib/**/*.test.{ts,tsx}',
        'lib/**/*.stories.tsx',
        'lib/**/index.ts',
        /*
            Storybook demo components, not library code. None of them is
            exported and none is in the bundle — checked, not assumed — so
            counting them only made the number describe something the package
            does not contain. What they do is covered by Playwright, against a
            real browser, which is the only place they exist.
         */
        'lib/components/inputEvents/**',
        'lib/components/financialInput/EventTesterPanel.tsx',
        'lib/components/financialInput/KeyboardTesterPanel.tsx',
        'lib/components/financialInput/CurrencyCombobox.tsx',
        'lib/Introduction.stories.tsx'
      ],
      /*
          100, and held there.

          Getting here meant deleting three functions nothing called rather
          than writing tests for them, and covering paths that had never run:
          the POSITIVE range guard, toExponent's rejections, reduceHistory's
          dispatch, clear and applyShortcut, the undo and redo keystrokes, and
          every Intl fallback.

          One line carries a v8 ignore, in useFinancialInput. React resets a
          controlled input's caret on re-render, so under jsdom the guard above
          it always short-circuits and setSelectionRange is unreachable.
          Playwright covers it in a real browser. Mocking selectionStart to
          force it would have tested the mock.
       */
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100
      }
    }
  }
});
