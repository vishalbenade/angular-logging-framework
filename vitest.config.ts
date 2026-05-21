import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vitest-angular';

export default defineConfig({
  plugins: [angular()],

  test: {
    // Makes describe/it/expect/vi/beforeEach available without imports
    globals: true,

    // Simulates browser DOM in Node.js
    environment: 'jsdom',

    // Runs before every test file — bootstraps Angular + MSW
    setupFiles: ['src/test-setup.ts'],

    // Only pick up files ending in .spec.ts inside src/
    include: ['src/**/*.spec.ts'],

    // Exclude Playwright E2E tests from Vitest
    exclude: ['e2e/**', 'node_modules/**'],

    coverage: {
      // V8 is Node's native coverage engine — fastest option
      provider: 'v8',

      // terminal summary + browseable HTML + CI-compatible lcov
      reporter: ['text', 'html', 'lcov'],

      reportsDirectory: 'coverage',

      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.module.ts',   // NgModule boilerplate
        'src/main.ts',          // Bootstrap entry point
        'src/test-setup.ts',    // Test infrastructure
        'src/mocks/**',         // Mock definitions
        'src/environments/**',  // Environment configs
      ],

      // Build fails if coverage drops below these numbers
      thresholds: {
        branches:   80,
        functions:  85,
        lines:      85,
        statements: 85,
      },
    },

    // Run spec files in parallel across CPU threads
    pool: 'threads',
    poolOptions: {
      threads: { singleThread: false },
    },

    // Clean text output for CI; add HTML report locally
    reporters: process.env['CI']
      ? ['verbose']
      : ['verbose', 'html'],
  },
});
