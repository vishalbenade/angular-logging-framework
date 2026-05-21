import { test, expect } from '@playwright/test';
import { UserDashboardPage } from '../pages/user-dashboard.page';

test.describe('User Grid', () => {
  let dashboard: UserDashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboard = new UserDashboardPage(page);
    await dashboard.goto();
    await dashboard.waitForGridReady();
  });

  // ── Rendering ─────────────────────────────────────────────────────────────

  test('displays users loaded from MSW-mocked API', async () => {
    expect(await dashboard.getRowCount()).toBeGreaterThan(0);
  });

  test('shows correct data in name column for row 0', async () => {
    const name = await dashboard.getCellText(0, 'name');
    expect(name).toBe('Alice');
  });

  test('shows correct data in role column for row 0', async () => {
    const role = await dashboard.getCellText(0, 'role');
    expect(role).toBe('admin');
  });

  // ── Search / quick filter ─────────────────────────────────────────────────

  test('filters rows when search text is entered', async () => {
    await dashboard.search('Bob');
    expect(await dashboard.getRowCount()).toBe(1);
    expect(await dashboard.getCellText(0, 'name')).toBe('Bob');
  });

  test('restores all rows when search is cleared', async () => {
    const initial = await dashboard.getRowCount();
    await dashboard.search('Bob');
    expect(await dashboard.getRowCount()).toBe(1);
    await dashboard.clearSearch();
    expect(await dashboard.getRowCount()).toBe(initial);
  });

  test('shows zero rows when search matches nothing', async () => {
    await dashboard.search('ZZZNONEXISTENT');
    expect(await dashboard.getRowCount()).toBe(0);
  });

  // ── Sorting ───────────────────────────────────────────────────────────────

  test('sorts name column ascending on first header click', async ({ page }) => {
    await dashboard.sortByColumn('name', 'asc');
    const first = await dashboard.getCellText(0, 'name');
    expect(first).toBe('Alice');
  });

  test('sorts name column descending on second header click', async ({ page }) => {
    await dashboard.sortByColumn('name', 'desc');
    const first = await dashboard.getCellText(0, 'name');
    expect(first).toBe('Carol');
  });

  // ── Virtual scroll (real browser required) ────────────────────────────────

  test('AG Grid header remains visible on vertical scroll', async ({ page }) => {
    const header    = page.locator('.ag-header');
    const initialY  = (await header.boundingBox())?.y;

    await page.locator('.ag-body-viewport').evaluate(el => { el.scrollTop = 200; });
    await page.waitForTimeout(100);

    const afterY = (await header.boundingBox())?.y;
    expect(afterY).toBe(initialY); // sticky header — Y position unchanged
  });

  // ── Column header existence ───────────────────────────────────────────────

  test('renders expected column headers', async ({ page }) => {
    await expect(page.locator('.ag-header-cell[col-id="name"]')).toBeVisible();
    await expect(page.locator('.ag-header-cell[col-id="email"]')).toBeVisible();
    await expect(page.locator('.ag-header-cell[col-id="role"]')).toBeVisible();
    await expect(page.locator('.ag-header-cell[col-id="status"]')).toBeVisible();
  });
});
