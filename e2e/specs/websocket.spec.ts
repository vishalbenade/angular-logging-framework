/**
 * WebSocket E2E tests — require a REAL browser + real WebSocket lifecycle.
 * Playwright's page.routeWebSocket() intercepts at the network layer,
 * letting us simulate connection drops and message delivery without
 * a real server. This is impossible in jsdom/Vitest.
 */
import { test, expect } from '@playwright/test';
import { UserDashboardPage } from '../pages/user-dashboard.page';

test.describe('WebSocket Live Updates', () => {

  // ── Status indicator ───────────────────────────────────────────────────────

  test('shows "connected" status after handshake completes', async ({ page }) => {
    await page.routeWebSocket('ws://localhost:4200/ws', ws => {
      ws.onConnect(() => { /* accept the connection */ });
    });

    const dashboard = new UserDashboardPage(page);
    await dashboard.goto();
    await dashboard.waitForGridReady();

    await expect(dashboard.wsStatusIndicator)
      .toHaveAttribute('data-status', 'connected', { timeout: 5_000 });
  });

  // ── Grid live updates ──────────────────────────────────────────────────────

  test('updates existing grid row when USER_UPDATED message received', async ({ page }) => {
    await page.routeWebSocket('ws://localhost:4200/ws', ws => {
      ws.onConnect(socket => {
        // Send update after grid has rendered
        setTimeout(() => {
          socket.send(JSON.stringify({
            type:    'USER_UPDATED',
            payload: { id: 1, name: 'Alice (Live Update)', email: 'alice@example.com', role: 'admin', status: 'active' },
          }));
        }, 800);
      });
    });

    const dashboard = new UserDashboardPage(page);
    await dashboard.goto();
    await dashboard.waitForGridReady();

    // Wait for live update to be applied
    await expect(
      page.locator('[row-index="0"] [col-id="name"]')
    ).toHaveText('Alice (Live Update)', { timeout: 5_000 });
  });

  test('adds new row to grid when USER_CREATED message received', async ({ page }) => {
    await page.routeWebSocket('ws://localhost:4200/ws', ws => {
      ws.onConnect(socket => {
        setTimeout(() => {
          socket.send(JSON.stringify({
            type:    'USER_CREATED',
            payload: { id: 99, name: 'Live New User', email: 'live@example.com', role: 'viewer', status: 'active' },
          }));
        }, 800);
      });
    });

    const dashboard = new UserDashboardPage(page);
    await dashboard.goto();
    await dashboard.waitForGridReady();

    await expect(page.getByText('Live New User')).toBeVisible({ timeout: 5_000 });
  });

  test('removes row from grid when USER_DELETED message received', async ({ page }) => {
    await page.routeWebSocket('ws://localhost:4200/ws', ws => {
      ws.onConnect(socket => {
        setTimeout(() => {
          socket.send(JSON.stringify({ type: 'USER_DELETED', payload: { id: 2 } }));
        }, 800);
      });
    });

    const dashboard = new UserDashboardPage(page);
    await dashboard.goto();
    await dashboard.waitForGridReady();

    // Bob (id=2) should disappear from the grid
    await expect(page.getByText('Bob')).not.toBeVisible({ timeout: 5_000 });
  });

  // ── Connection drop + reconnection (requires real browser) ─────────────────

  test('shows "disconnected" status when connection drops', async ({ page }) => {
    await page.routeWebSocket('ws://localhost:4200/ws', ws => {
      ws.onConnect(socket => {
        // Drop connection 300ms after it opens
        setTimeout(() => socket.close(), 300);
      });
    });

    const dashboard = new UserDashboardPage(page);
    await dashboard.goto();

    await expect(dashboard.wsStatusIndicator)
      .toHaveAttribute('data-status', 'disconnected', { timeout: 5_000 });
  });

  test('transitions through "reconnecting" state after unexpected drop', async ({ page }) => {
    const statuses: string[] = [];

    await page.routeWebSocket('ws://localhost:4200/ws', ws => {
      ws.onConnect(socket => {
        setTimeout(() => socket.close(), 200);
      });
    });

    const dashboard = new UserDashboardPage(page);
    await dashboard.goto();

    // Capture status transitions
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="ws-status"]');
        return el?.getAttribute('data-status') === 'reconnecting';
      },
      { timeout: 5_000 }
    );

    const status = await dashboard.wsStatusIndicator.getAttribute('data-status');
    expect(['reconnecting', 'disconnected']).toContain(status);
  });

  test('resumes live updates after successful reconnection', async ({ page }) => {
    let connectCount = 0;

    await page.routeWebSocket('ws://localhost:4200/ws', ws => {
      ws.onConnect(socket => {
        connectCount++;

        if (connectCount === 1) {
          // First connection: drop after 200ms
          setTimeout(() => socket.close(), 200);
        } else {
          // Second connection (reconnect): send a live update
          setTimeout(() => {
            socket.send(JSON.stringify({
              type:    'USER_UPDATED',
              payload: { id: 1, name: 'Alice (Post-Reconnect)', email: 'alice@example.com', role: 'admin', status: 'active' },
            }));
          }, 400);
        }
      });
    });

    const dashboard = new UserDashboardPage(page);
    await dashboard.goto();
    await dashboard.waitForGridReady();

    // Wait for reconnect + live update
    await expect(
      page.locator('[row-index="0"] [col-id="name"]')
    ).toHaveText('Alice (Post-Reconnect)', { timeout: 10_000 });
  });

  // ── Stale data banner ──────────────────────────────────────────────────────

  test('stale data state is recoverable — grid data persists during disconnection', async ({ page }) => {
    await page.routeWebSocket('ws://localhost:4200/ws', ws => {
      ws.onConnect(socket => {
        setTimeout(() => socket.close(), 300);
      });
    });

    const dashboard = new UserDashboardPage(page);
    await dashboard.goto();
    await dashboard.waitForGridReady();

    // Grid data should still be visible even after WS drops
    await expect(page.getByText('Alice')).toBeVisible();
  });
});
