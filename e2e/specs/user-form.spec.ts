import { test, expect } from '@playwright/test';
import { UserDashboardPage } from '../pages/user-dashboard.page';

test.describe('User Form', () => {
  let dashboard: UserDashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboard = new UserDashboardPage(page);
    await dashboard.goto();
    await dashboard.waitForGridReady();
    await dashboard.openAddUserForm();
  });

  // ── Visibility ────────────────────────────────────────────────────────────

  test('shows form panel after clicking Add User', async () => {
    await expect(dashboard.formPanel).toBeVisible();
  });

  test('shows Name, Email, and Role fields', async ({ page }) => {
    await expect(page.getByLabel('Name')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Role')).toBeVisible();
  });

  test('submit button is disabled on empty form', async ({ page }) => {
    await expect(page.getByRole('button', { name: /submit/i })).toBeDisabled();
  });

  // ── Validation ────────────────────────────────────────────────────────────

  test('shows Name required error after clicking submit on empty form', async ({ page }) => {
    await page.getByRole('button', { name: /submit/i }).click();
    await expect(page.getByText(/name is required/i)).toBeVisible();
  });

  test('shows invalid email error for malformed email', async ({ page }) => {
    await page.getByLabel('Email').fill('not-an-email');
    await page.keyboard.press('Tab');
    await expect(page.getByText(/invalid email format/i)).toBeVisible();
  });

  test('clears email error after entering valid email', async ({ page }) => {
    await page.getByLabel('Email').fill('bad');
    await page.keyboard.press('Tab');
    await expect(page.getByText(/invalid email format/i)).toBeVisible();

    await page.getByLabel('Email').fill('good@example.com');
    await page.keyboard.press('Tab');
    await expect(page.getByText(/invalid email format/i)).not.toBeVisible();
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  test('creates user and closes form on valid submit', async ({ page }) => {
    await dashboard.fillAndSubmitForm('New User', 'newuser@example.com', 'viewer');

    await expect(dashboard.formPanel).not.toBeVisible({ timeout: 5_000 });
  });

  test('newly created user appears in the grid', async ({ page }) => {
    await dashboard.fillAndSubmitForm('Eve', 'eve@example.com', 'admin');

    await expect(dashboard.formPanel).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Eve')).toBeVisible({ timeout: 5_000 });
  });

  // ── Error path ────────────────────────────────────────────────────────────

  test('shows API error message when server returns 422', async ({ page }) => {
    await page.route('**/api/users', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Email already taken' }),
        });
      } else {
        await route.continue();
      }
    });

    await dashboard.fillAndSubmitForm('Alice', 'alice@example.com');
    await expect(dashboard.errorAlert).toContainText('Email already taken');
  });

  test('re-enables submit after API error', async ({ page }) => {
    await page.route('**/api/users', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 500 });
      } else {
        await route.continue();
      }
    });

    await dashboard.fillAndSubmitForm('Alice', 'alice@example.com');

    await expect(
      page.getByRole('button', { name: /submit/i })
    ).toBeEnabled({ timeout: 3_000 });
  });

  // ── Cancel ────────────────────────────────────────────────────────────────

  test('closes form when Cancel is clicked', async ({ page }) => {
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(dashboard.formPanel).not.toBeVisible();
  });

  test('does not add user to grid when form is cancelled', async ({ page }) => {
    await page.getByLabel('Name').fill('Cancelled User');
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByText('Cancelled User')).not.toBeVisible();
  });
});
