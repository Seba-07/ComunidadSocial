import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: ['./__tests__/setup.js'],
    include: ['__tests__/**/*.test.js'],
    fileParallelism: false,
    sequence: { concurrent: false }
  }
});
