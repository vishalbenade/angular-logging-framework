import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { signal } from '@angular/core';
import { DashboardPageComponent } from './dashboard-page.component';
import { RootOrdersService } from '../../features/dashboard/services/root-orders.service';
import { FlowSelectionService } from '../../shared/services/core/flow-selection.service';

// ── Stub child components ──────────────────────────────────────────────────────
// We stub every child component so tests focus only on DashboardPageComponent
// logic — not on child component internals or their own dependencies.
import { Component } from '@angular/core';

@Component({ selector: 'app-root-orders',                standalone: true, template: '' })
class MockRootOrdersComponent {}

@Component({ selector: 'app-slice-orders',               standalone: true, template: '' })
class MockSliceOrdersComponent {}

@Component({ selector: 'tickets-created',                standalone: true, template: '' })
class MockTicketsCreatedComponent {}

@Component({ selector: 'app-market-view',                standalone: true, template: '' })
class MockMarketViewComponent {}

@Component({ selector: 'app-summary-details-orders-grid', standalone: true, template: '' })
class MockSummaryDetailsOrdersGridComponent {}

// ── Mock service factories ─────────────────────────────────────────────────────
function buildRootOrdersService(tab: string = 'orders') {
  return {
    selectedRootOrderFilter: signal(tab),
  };
}

function buildFlowSelectionService() {
  return {
    // add any methods/signals FlowSelectionService exposes if needed
  };
}

// ── Render helper ──────────────────────────────────────────────────────────────
async function renderComponent(tab = 'orders') {
  const rootOrdersService  = buildRootOrdersService(tab);
  const flowService        = buildFlowSelectionService();

  return render(DashboardPageComponent, {
    providers: [
      { provide: RootOrdersService,   useValue: rootOrdersService },
      { provide: FlowSelectionService, useValue: flowService },
    ],
    // Override child component imports with stubs
    componentImports: [
      MockRootOrdersComponent,
      MockSliceOrdersComponent,
      MockTicketsCreatedComponent,
      MockMarketViewComponent,
      MockSummaryDetailsOrdersGridComponent,
    ],
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('DashboardPageComponent', () => {

  // ── Rendering ─────────────────────────────────────────────────────────────

  it('renders the dashboard container', async () => {
    const { container } = await renderComponent();
    expect(container.querySelector('.dashboard-container')).toBeTruthy();
  });

  // ── selectedTab computed signal ────────────────────────────────────────────

  it('selectedTab returns value from rootOrdersService.selectedRootOrderFilter()', async () => {
    const { fixture } = await renderComponent('orders');
    const component   = fixture.componentInstance;
    expect(component.selectedTab()).toBe('orders');
  });

  it('selectedTab reflects "summary" when service returns "summary"', async () => {
    const { fixture } = await renderComponent('summary');
    const component   = fixture.componentInstance;
    expect(component.selectedTab()).toBe('summary');
  });

  // ── @if (selectedTab() !== 'summary') — split view ────────────────────────

  it('renders split-pane layout when selectedTab is "orders"', async () => {
    const { container } = await renderComponent('orders');
    expect(container.querySelector('app-root-orders')).toBeTruthy();
    expect(container.querySelector('app-slice-orders')).toBeTruthy();
    expect(container.querySelector('app-market-view')).toBeTruthy();
    expect(container.querySelector('tickets-created')).toBeTruthy();
  });

  it('renders split-pane layout when selectedTab is "slice"', async () => {
    const { container } = await renderComponent('slice');
    expect(container.querySelector('app-root-orders')).toBeTruthy();
    expect(container.querySelector('app-slice-orders')).toBeTruthy();
  });

  it('does NOT render summary grid when selectedTab is not "summary"', async () => {
    const { container } = await renderComponent('orders');
    expect(
      container.querySelector('app-summary-details-orders-grid')
    ).toBeFalsy();
  });

  // ── @else — summary view ──────────────────────────────────────────────────

  it('renders summary grid when selectedTab is "summary"', async () => {
    const { container } = await renderComponent('summary');
    expect(
      container.querySelector('app-summary-details-orders-grid')
    ).toBeTruthy();
  });

  it('does NOT render split-pane components when selectedTab is "summary"', async () => {
    const { container } = await renderComponent('summary');
    expect(container.querySelector('app-root-orders')).toBeFalsy();
    expect(container.querySelector('app-slice-orders')).toBeFalsy();
    expect(container.querySelector('app-market-view')).toBeFalsy();
    expect(container.querySelector('tickets-created')).toBeFalsy();
  });

  // ── Reactive — signal change updates the view ──────────────────────────────

  it('switches to summary view when selectedTab signal changes to "summary"', async () => {
    const rootOrdersService = buildRootOrdersService('orders');

    const { container, fixture } = await render(DashboardPageComponent, {
      providers: [
        { provide: RootOrdersService,    useValue: rootOrdersService },
        { provide: FlowSelectionService, useValue: buildFlowSelectionService() },
      ],
      componentImports: [
        MockRootOrdersComponent,
        MockSliceOrdersComponent,
        MockTicketsCreatedComponent,
        MockMarketViewComponent,
        MockSummaryDetailsOrdersGridComponent,
      ],
    });

    // Initially shows split pane
    expect(container.querySelector('app-root-orders')).toBeTruthy();

    // Change signal to 'summary'
    rootOrdersService.selectedRootOrderFilter.set('summary');
    fixture.detectChanges();

    // Now shows summary grid
    expect(container.querySelector('app-summary-details-orders-grid')).toBeTruthy();
    expect(container.querySelector('app-root-orders')).toBeFalsy();
  });

  it('switches back to split view when selectedTab changes from "summary" to "orders"', async () => {
    const rootOrdersService = buildRootOrdersService('summary');

    const { container, fixture } = await render(DashboardPageComponent, {
      providers: [
        { provide: RootOrdersService,    useValue: rootOrdersService },
        { provide: FlowSelectionService, useValue: buildFlowSelectionService() },
      ],
      componentImports: [
        MockRootOrdersComponent,
        MockSliceOrdersComponent,
        MockTicketsCreatedComponent,
        MockMarketViewComponent,
        MockSummaryDetailsOrdersGridComponent,
      ],
    });

    // Initially shows summary
    expect(container.querySelector('app-summary-details-orders-grid')).toBeTruthy();

    // Change back to orders
    rootOrdersService.selectedRootOrderFilter.set('orders');
    fixture.detectChanges();

    // Now shows split pane
    expect(container.querySelector('app-root-orders')).toBeTruthy();
    expect(container.querySelector('app-summary-details-orders-grid')).toBeFalsy();
  });

  // ── Summary Details card structure ────────────────────────────────────────

  it('renders Summary Details card title in summary view', async () => {
    const { container } = await renderComponent('summary');
    expect(container.querySelector('.card-title')?.textContent)
      .toContain('Summary Details');
  });
});
