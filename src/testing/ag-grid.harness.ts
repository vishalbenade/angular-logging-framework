/**
 * AgGridHarness — reusable AG Grid v33 test utility.
 *
 * WHY a harness:
 *   - Single place to update if AG Grid renames an API method.
 *   - Hides setTimeout/detectChanges boilerplate from every spec.
 *   - Enforces PII convention: never reads raw cell text from DOM.
 *
 * USAGE:
 *   harness = new AgGridHarness(fixture, () => component.gridApi);
 *   await harness.waitForGrid();
 *   expect(harness.getRowCount()).toBe(3);
 */
import { ComponentFixture } from '@angular/core/testing';
import type { GridApi } from 'ag-grid-community';

export class AgGridHarness {
  constructor(
    private readonly fixture: ComponentFixture<unknown>,
    private readonly getApi: () => GridApi,
  ) {}

  /** Waits for AG Grid async initialisation cycle to complete. */
  async waitForGrid(): Promise<void> {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    this.fixture.detectChanges();
  }

  /** Displayed row count — respects active filters and grouping. */
  getRowCount(): number {
    return this.getApi().getDisplayedRowCount();
  }

  /** Raw data object for a displayed row — never reads DOM text. */
  getRowData(index: number): Record<string, unknown> {
    const node = this.getApi().getDisplayedRowAtIndex(index);
    if (!node) throw new Error(`Row at index ${index} not found`);
    return node.data as Record<string, unknown>;
  }

  /** Field value from a displayed row. colId matches ColDef.field. */
  getCellValue(row: number, colId: string): unknown {
    return this.getRowData(row)[colId];
  }

  /** All currently selected rows. */
  getSelectedRows(): unknown[] {
    return this.getApi().getSelectedRows();
  }

  /** Selects a row via GridApi — more reliable than DOM clicks. */
  async selectRow(index: number): Promise<void> {
    const node = this.getApi().getDisplayedRowAtIndex(index);
    if (!node) throw new Error(`Row at index ${index} not found`);
    node.setSelected(true);
    this.fixture.detectChanges();
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }

  /** Applies a column text filter — tests logic, not filter UI. */
  async applyColumnFilter(colId: string, value: string): Promise<void> {
    this.getApi().setFilterModel({
      [colId]: { filterType: 'text', type: 'contains', filter: value },
    });
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    this.fixture.detectChanges();
  }

  /** Clears all active column filters. */
  async clearAllFilters(): Promise<void> {
    this.getApi().setFilterModel(null);
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    this.fixture.detectChanges();
  }

  /** Applies a column sort — tests logic, not header click. */
  async sortColumn(colId: string, direction: 'asc' | 'desc'): Promise<void> {
    this.getApi().applyColumnState({
      state: [{ colId, sort: direction }],
      defaultState: { sort: null },
    });
    this.fixture.detectChanges();
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }

  /** Applies AG Grid quick filter (searches all columns). */
  async setQuickFilter(text: string): Promise<void> {
    this.getApi().setGridOption('quickFilterText', text);
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    this.fixture.detectChanges();
  }

  /** Returns all displayed rows as an array — useful for snapshots. */
  getAllRowData(): Record<string, unknown>[] {
    return Array.from(
      { length: this.getRowCount() },
      (_, i) => this.getRowData(i)
    );
  }
}
