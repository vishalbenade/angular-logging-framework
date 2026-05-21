/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    exclude: ['e2e/**', 'node_modules/**'],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.module.ts',
        'src/main.ts',
        'src/test-setup.ts',
        'src/mocks/**',
        'src/environments/**',
      ],
      thresholds: {
        branches:   80,
        functions:  85,
        lines:      85,
        statements: 85,
      },
    },

    pool: 'forks',
    reporters: process.env['CI'] ? ['verbose'] : ['verbose'],
  },
});
