
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['server/**/*.test.ts', 'server/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'client'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'server/tests/',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/',
        'client/'
      ]
    },
    setupFiles: [],
    testTimeout: 10000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './server'),
      '@shared': path.resolve(__dirname, './shared')
    }
  }
});
