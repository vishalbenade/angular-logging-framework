/**
 * Page Object Model for the User Dashboard.
 *
 * WHY POM: If a selector changes (e.g. placeholder text, data-testid),
 * fix it here once — all E2E specs automatically use the updated selector.
 * Specs stay readable and don't contain fragile CSS selectors.
 */
import { Page, Locator } from '@playwright/test';

export class UserDashboardPage {
  // ── Locators — defined once, reused across all specs ─────────────────────
  readonly searchInput:        Locator;
  readonly addUserButton:      Locator;
  readonly grid:               Locator;
  readonly wsStatusIndicator:  Locator;
  readonly loadingIndicator:   Locator;
  readonly errorAlert:         Locator;
  readonly retryButton:        Locator;
  readonly formPanel:          Locator;

  constructor(private readonly page: Page) {
    this.searchInput       = page.getByPlaceholder('Search users');
    this.addUserButton     = page.getByRole('button', { name: /add user/i });
    this.grid              = page.locator('ag-grid-angular');
    this.wsStatusIndicator = page.getByTestId('ws-status');
    this.loadingIndicator  = page.getByRole('status');
    this.errorAlert        = page.getByRole('alert');
    this.retryButton       = page.getByRole('button', { name: /retry/i });
    this.formPanel         = page.getByTestId('form-panel');
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  /**
   * Waits until at least one data row is present — more reliable than
   * page.waitForTimeout() because it responds to actual content, not time.
   */
  async waitForGridReady(): Promise<void> {
    await this.grid
      .locator('[role="row"][row-index]')
      .first()
      .waitFor({ timeout: 10_000 });
  }

  /** Number of currently displayed rows (respects active filters). */
  async getRowCount(): Promise<number> {
    return this.grid.locator('[role="row"][row-index]').count();
  }

  /**
   * Inner text of a specific cell.
   * AG Grid adds col-id and row-index attributes — stable selectors.
   */
  async getCellText(rowIndex: number, colId: string): Promise<string> {
    return this.grid
      .locator(`[row-index="${rowIndex}"] [col-id="${colId}"]`)
      .innerText();
  }

  /** Clicks a specific cell (for row selection or inline edit). */
  async clickCell(rowIndex: number, colId: string): Promise<void> {
    await this.grid
      .locator(`[row-index="${rowIndex}"] [col-id="${colId}"]`)
      .click();
  }

  /**
   * Types in the search box and waits for debounce to fire.
   * Adjust the 300ms timeout to match your debounceTime() value.
   */
  async search(text: string): Promise<void> {
    await this.searchInput.fill(text);
    await this.page.waitForTimeout(350); // debounce settle time
  }

  /** Clears the search box and waits for filter to clear. */
  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
    await this.page.waitForTimeout(350);
  }

  /** Clicks the Add User button to open the creation form. */
  async openAddUserForm(): Promise<void> {
    await this.addUserButton.click();
    await this.formPanel.waitFor();
  }

  /** Fills and submits the Add User form. */
  async fillAndSubmitForm(name: string, email: string, role: 'viewer' | 'admin' = 'viewer'): Promise<void> {
    await this.page.getByLabel('Name').fill(name);
    await this.page.getByLabel('Email').fill(email);
    await this.page.selectOption('select#role', role);
    await this.page.getByRole('button', { name: /submit/i }).click();
  }

  /**
   * Clicks an AG Grid column header to sort.
   * Clicks twice for descending.
   */
  async sortByColumn(colId: string, direction: 'asc' | 'desc' = 'asc'): Promise<void> {
    const header = this.page.locator(`.ag-header-cell[col-id="${colId}"] .ag-header-cell-label`);
    await header.click(); // first click = asc
    if (direction === 'desc') {
      await header.click(); // second click = desc
    }
  }
}
