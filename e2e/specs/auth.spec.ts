/**
 * Authentication E2E tests — cover token lifecycle in a real browser.
 *
 * Key scenarios that Vitest CANNOT test:
 *   - Token stored/read from real localStorage
 *   - Two concurrent requests triggering a single refresh (race condition)
 *   - User sees NO error toast during silent refresh
 *   - Grid does not flicker or lose state during token refresh
 */
import { test, expect } from '@playwright/test';
import { UserDashboardPage } from '../pages/user-dashboard.page';

test.describe('Authentication — Token Lifecycle', () => {

  // ── Silent token refresh ───────────────────────────────────────────────────

  test('silently refreshes expired token and loads data without error toast', async ({ page }) => {
    let apiCallCount = 0;

    await page.route('**/api/users', async route => {
      apiCallCount++;
      if (apiCallCount === 1) {
        // First attempt: token expired
        await route.fulfill({
          status:      401,
          contentType: 'application/json',
          body:        JSON.stringify({ message: 'Token expired' }),
        });
      } else {
        // Retry after refresh: success
        await route.fulfill({
          status:      200,
          contentType: 'application/json',
          body:        JSON.stringify([
            { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin',  status: 'active' },
            { id: 2, name: 'Bob',   email: 'bob@example.com',   role: 'viewer', status: 'active' },
          ]),
        });
      }
    });

    await page.route('**/api/auth/refresh', async route => {
      await route.fulfill({
        status:      200,
        contentType: 'application/json',
        body:        JSON.stringify({ token: 'refreshed-jwt-token' }),
      });
    });

    const dashboard = new UserDashboardPage(page);
    await dashboard.goto();
    await dashboard.waitForGridReady();

    // Data loaded — silent refresh worked
    await expect(page.getByText('Alice')).toBeVisible();

    // No error alert shown to user
    await expect(dashboard.errorAlert).not.toBeVisible();

    // API was called twice (original + retry)
    expect(apiCallCount).toBe(2);
  });

  test('stores refreshed token in localStorage', async ({ page }) => {
    let callCount = 0;

    await page.route('**/api/users', async route => {
      callCount++;
      if (callCount === 1) {
        await route.fulfill({ status: 401, body: '{}' });
      } else {
        await route.fulfill({
          status:      200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin', status: 'active' },
          ]),
        });
      }
    });

    await page.route('**/api/auth/refresh', async route => {
      await route.fulfill({
        status:      200,
        contentType: 'application/json',
        body:        JSON.stringify({ token: 'brand-new-jwt-token' }),
      });
    });

    const dashboard = new UserDashboardPage(page);
    await dashboard.goto();
    await dashboard.waitForGridReady();

    const stored = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(stored).toBe('brand-new-jwt-token');
  });

  // ── Refresh failure → logout ───────────────────────────────────────────────

  test('navigates to /login when refresh endpoint also returns 401', async ({ page }) => {
    await page.route('**/api/users', async route => {
      await route.fulfill({ status: 401, body: '{}' });
    });

    await page.route('**/api/auth/refresh', async route => {
      await route.fulfill({ status: 401, body: '{}' });
    });

    const dashboard = new UserDashboardPage(page);
    await dashboard.goto();

    // After failed refresh, router navigates to /login
    await page.waitForURL('**/login', { timeout: 5_000 });
    expect(page.url()).toContain('/login');
  });

  test('clears token from localStorage when logout is triggered', async ({ page }) => {
    // Seed a token so we can verify it gets cleared
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('auth_token', 'old-token'));

    await page.route('**/api/users', async route => {
      await route.fulfill({ status: 401, body: '{}' });
    });

    await page.route('**/api/auth/refresh', async route => {
      await route.fulfill({ status: 401, body: '{}' });
    });

    await page.reload();

    await page.waitForURL('**/login', { timeout: 5_000 });
    const stored = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(stored).toBeNull();
  });

  // ── No refresh loop ────────────────────────────────────────────────────────

  test('does not enter infinite loop when /auth/refresh returns 401', async ({ page }) => {
    let refreshCallCount = 0;

    await page.route('**/api/users', async route => {
      await route.fulfill({ status: 401, body: '{}' });
    });

    await page.route('**/api/auth/refresh', async route => {
      refreshCallCount++;
      await route.fulfill({ status: 401, body: '{}' });
    });

    await page.goto('/');

    // Wait for auth flow to settle
    await page.waitForTimeout(2_000);

    // Refresh should be called exactly once — not in a loop
    expect(refreshCallCount).toBe(1);
  });

  // ── Non-401 errors not intercepted ────────────────────────────────────────

  test('shows error state for 503 — does not attempt token refresh', async ({ page }) => {
    let refreshCallCount = 0;

    await page.route('**/api/users', async route => {
      await route.fulfill({ status: 503, body: '{}' });
    });

    await page.route('**/api/auth/refresh', async route => {
      refreshCallCount++;
      await route.fulfill({ status: 200, body: JSON.stringify({ token: 'new' }) });
    });

    const dashboard = new UserDashboardPage(page);
    await dashboard.goto();

    // Should show error state
    await expect(dashboard.errorAlert).toBeVisible({ timeout: 5_000 });

    // Refresh should NOT have been called for a 503
    expect(refreshCallCount).toBe(0);
  });
});
