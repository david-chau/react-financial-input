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
        currency: resolve(rootDir, 'lib/currency.ts'),
        events: resolve(rootDir, 'lib/events.ts')
      },
      formats: ['es', 'cjs'],
      fileName: (format, name) => `${name}.${format === 'es' ? 'js' : 'cjs'}`
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        // Lets the component be imported from a Next.js App Router server file.
        banner: "'use client';"
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
          A floor, not a target. It is here so coverage cannot quietly slide;
          raising it is a decision, and lowering it should need an argument.
       */
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90
      }
    }
  }
});
