import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { UserGridComponent } from './user-grid.component';
import { AgGridHarness } from '../../../testing/ag-grid.harness';
import type { User } from '../../core/models/user.model';

const MOCK_USERS: User[] = [
  { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin',  status: 'active'   },
  { id: 2, name: 'Bob',   email: 'bob@example.com',   role: 'viewer', status: 'inactive' },
  { id: 3, name: 'Carol', email: 'carol@example.com', role: 'admin',  status: 'active'   },
];

describe('UserGridComponent', () => {
  let fixture:   ComponentFixture<UserGridComponent>;
  let component: UserGridComponent;
  let harness:   AgGridHarness;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserGridComponent],
    }).compileComponents();

    fixture           = TestBed.createComponent(UserGridComponent);
    component         = fixture.componentInstance;
    component.rowData = MOCK_USERS;
    fixture.detectChanges();

    harness = new AgGridHarness(fixture, () => component.gridApi);
    await harness.waitForGrid();
  });

  // ── Rendering ───────────────────────────────────────────────────────────────

  it('renders all rows from rowData input', () => {
    expect(harness.getRowCount()).toBe(3);
  });

  it('renders correct cell values for row 0', () => {
    expect(harness.getCellValue(0, 'name')).toBe('Alice');
    expect(harness.getCellValue(0, 'email')).toBe('alice@example.com');
    expect(harness.getCellValue(0, 'role')).toBe('admin');
    expect(harness.getCellValue(0, 'status')).toBe('active');
  });

  it('renders correct cell values for row 1', () => {
    expect(harness.getCellValue(1, 'name')).toBe('Bob');
    expect(harness.getCellValue(1, 'status')).toBe('inactive');
  });

  it('emits gridReadyEvent when grid initialises', async () => {
    const readySpy = vi.fn();
    fixture2: {
      // Re-create to capture the event
      const f = TestBed.createComponent(UserGridComponent);
      f.componentInstance.rowData = MOCK_USERS;
      f.componentInstance.gridReadyEvent.subscribe(readySpy);
      f.detectChanges();
      await new Promise(r => setTimeout(r, 0));
      expect(readySpy).toHaveBeenCalledOnce();
    }
  });

  // ── Filtering ───────────────────────────────────────────────────────────────

  it('filters rows by name column', async () => {
    await harness.applyColumnFilter('name', 'Carol');
    expect(harness.getRowCount()).toBe(1);
    expect(harness.getCellValue(0, 'name')).toBe('Carol');
  });

  it('filters rows by role column', async () => {
    await harness.applyColumnFilter('role', 'viewer');
    expect(harness.getRowCount()).toBe(1);
    expect(harness.getCellValue(0, 'name')).toBe('Bob');
  });

  it('filters rows by status column', async () => {
    await harness.applyColumnFilter('status', 'active');
    expect(harness.getRowCount()).toBe(2);
  });

  it('shows 0 rows when filter matches nothing', async () => {
    await harness.applyColumnFilter('name', 'ZZZNONEXISTENT');
    expect(harness.getRowCount()).toBe(0);
  });

  it('restores all rows after clearing filters', async () => {
    await harness.applyColumnFilter('name', 'Alice');
    expect(harness.getRowCount()).toBe(1);
    await harness.clearAllFilters();
    expect(harness.getRowCount()).toBe(3);
  });

  it('applies quick filter across all columns', async () => {
    await harness.setQuickFilter('carol@example.com');
    expect(harness.getRowCount()).toBe(1);
    expect(harness.getCellValue(0, 'name')).toBe('Carol');
  });

  // ── Sorting ─────────────────────────────────────────────────────────────────

  it('sorts by name ascending', async () => {
    await harness.sortColumn('name', 'asc');
    expect(harness.getCellValue(0, 'name')).toBe('Alice');
    expect(harness.getCellValue(2, 'name')).toBe('Carol');
  });

  it('sorts by name descending', async () => {
    await harness.sortColumn('name', 'desc');
    expect(harness.getCellValue(0, 'name')).toBe('Carol');
    expect(harness.getCellValue(2, 'name')).toBe('Alice');
  });

  it('sorts by id ascending', async () => {
    await harness.sortColumn('id', 'asc');
    expect(harness.getCellValue(0, 'id')).toBe(1);
    expect(harness.getCellValue(2, 'id')).toBe(3);
  });

  // ── Selection ───────────────────────────────────────────────────────────────

  it('selects a row and emits the correct user', async () => {
    const emitSpy = vi.fn();
    component.rowSelected.subscribe(emitSpy);

    await harness.selectRow(1);

    expect(emitSpy).toHaveBeenCalledWith(MOCK_USERS[1]);
    expect(harness.getSelectedRows()).toHaveLength(1);
  });

  it('replaces selection when a different row is selected', async () => {
    await harness.selectRow(0);
    await harness.selectRow(2);
    expect(harness.getSelectedRows()).toHaveLength(1);
    expect((harness.getSelectedRows()[0] as User).name).toBe('Carol');
  });

  // ── PII Guard ───────────────────────────────────────────────────────────────

  it('DOES NOT log cell values to console (PII protection)', () => {
    const logSpy   = vi.spyOn(console, 'log');
    const warnSpy  = vi.spyOn(console, 'warn');
    const errorSpy = vi.spyOn(console, 'error');

    // Trigger common grid interactions
    harness.getRowData(0);
    harness.getCellValue(0, 'name');
    harness.getAllRowData();

    const allLogged = [
      ...logSpy.mock.calls.flat(),
      ...warnSpy.mock.calls.flat(),
      ...errorSpy.mock.calls.flat(),
    ].join(' ');

    // Verify no PII leaked via logging
    expect(allLogged).not.toContain('Alice');
    expect(allLogged).not.toContain('alice@example.com');
    expect(allLogged).not.toContain('Bob');
  });

  // ── Data update ─────────────────────────────────────────────────────────────

  it('updates displayed rows when rowData input changes', async () => {
    component.rowData = [MOCK_USERS[0]];
    fixture.detectChanges();
    await harness.waitForGrid();
    expect(harness.getRowCount()).toBe(1);
  });

  it('shows 0 rows when rowData is set to empty array', async () => {
    component.rowData = [];
    fixture.detectChanges();
    await harness.waitForGrid();
    expect(harness.getRowCount()).toBe(0);
  });
});
