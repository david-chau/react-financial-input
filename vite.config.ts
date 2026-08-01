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
        'lib/**/index.ts'
      ]
    }
  }
});
