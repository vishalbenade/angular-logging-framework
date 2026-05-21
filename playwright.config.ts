import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/specs',

  // Run all test files in parallel
  fullyParallel: true,

  // Retry on CI only — local failures should be obvious
  retries: process.env['CI'] ? 2 : 0,

  // Limit parallel workers on CI to avoid resource exhaustion
  workers: process.env['CI'] ? 2 : undefined,

  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  use: {
    // All page.goto('/path') calls are relative to this
    baseURL: 'http://localhost:4200',

    // Record execution trace on first retry — view with: npx playwright show-trace
    trace: 'on-first-retry',

    // Screenshot captured only on failure — attached to HTML report
    screenshot: 'only-on-failure',

    // Record video on first retry for complex debugging
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start Angular dev server before running E2E tests
  webServer: {
    command: 'ng serve --configuration=test',
    url: 'http://localhost:4200',
    // Reuse running server locally — always start fresh in CI
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
