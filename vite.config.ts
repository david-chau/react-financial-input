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
      entry: resolve(rootDir, 'lib/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs')
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
