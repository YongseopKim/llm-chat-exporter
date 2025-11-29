import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['dist/**', 'tests/**', '*.config.*', 'node_modules/**'],
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
