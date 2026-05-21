/**
 * Integration tests — wires UserDashboardComponent with real UserService
 * but mocks WebSocketService to avoid WebSocket connections.
 * HTTP calls are intercepted by MSW (configured in test-setup.ts).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { BehaviorSubject, Subject } from 'rxjs';
import { server } from '../../../mocks/server';
import { http, HttpResponse } from 'msw';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { UserDashboardComponent } from './user-dashboard.component';
import { WebSocketService, WsStatus } from '../../core/services/websocket.service';
import type { WsMessage } from '../../core/services/websocket.service';

// ── WebSocket mock factory ─────────────────────────────────────────────────────
function buildMockWsService(initialStatus: WsStatus = 'connected') {
  const messages$ = new Subject<WsMessage>();
  const status$   = new BehaviorSubject<WsStatus>(initialStatus);
  return {
    messages$: messages$.asObservable(),
    status$:   status$.asObservable(),
    connect:   vi.fn(),
    send:      vi.fn(),
    disconnect: vi.fn(),
    // Expose for test control
    _messages$: messages$,
    _status$:   status$,
  };
}

const DEFAULT_PROVIDERS = (wsService = buildMockWsService()) => [
  provideHttpClient(),
  provideRouter([]),
  { provide: WebSocketService, useValue: wsService },
];

describe('UserDashboardComponent (integration)', () => {

  // ── Loading and rendering ───────────────────────────────────────────────────

  it('shows loading indicator while fetching users', async () => {
    await render(UserDashboardComponent, { providers: DEFAULT_PROVIDERS() });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('loads and displays users from API via MSW', async () => {
    await render(UserDashboardComponent, { providers: DEFAULT_PROVIDERS() });
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Carol')).toBeInTheDocument();
    });
  });

  it('hides loading indicator after data loads', async () => {
    await render(UserDashboardComponent, { providers: DEFAULT_PROVIDERS() });
    await waitFor(() => screen.getByText('Alice'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  // ── Error state ─────────────────────────────────────────────────────────────

  it('shows error alert when API returns 503', async () => {
    server.use(
      http.get('/api/users', () =>
        HttpResponse.json({ message: 'Service Unavailable' }, { status: 503 })
      )
    );
    await render(UserDashboardComponent, { providers: DEFAULT_PROVIDERS() });
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/failed to load/i)
    );
  });

  it('shows Retry button on error', async () => {
    server.use(http.get('/api/users', () => HttpResponse.json({}, { status: 500 })));
    await render(UserDashboardComponent, { providers: DEFAULT_PROVIDERS() });
    await waitFor(() => expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument());
  });

  it('retries loading users when Retry is clicked', async () => {
    let callCount = 0;
    server.use(
      http.get('/api/users', () => {
        callCount++;
        if (callCount === 1) return HttpResponse.json({}, { status: 500 });
        return HttpResponse.json([
          { id: 1, name: 'Alice', email: 'a@a.com', role: 'admin', status: 'active' },
        ]);
      })
    );

    const user = userEvent.setup();
    await render(UserDashboardComponent, { providers: DEFAULT_PROVIDERS() });
    await waitFor(() => screen.getByRole('button', { name: /retry/i }));
    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
  });

  // ── Add user form ───────────────────────────────────────────────────────────

  it('shows Add User button', async () => {
    await render(UserDashboardComponent, { providers: DEFAULT_PROVIDERS() });
    expect(screen.getByRole('button', { name: /add user/i })).toBeInTheDocument();
  });

  it('shows form when Add User is clicked', async () => {
    const user = userEvent.setup();
    await render(UserDashboardComponent, { providers: DEFAULT_PROVIDERS() });
    await user.click(screen.getByRole('button', { name: /add user/i }));
    await waitFor(() => expect(screen.getByTestId('form-panel')).toBeInTheDocument());
  });

  it('hides form when Cancel is clicked', async () => {
    const user = userEvent.setup();
    await render(UserDashboardComponent, { providers: DEFAULT_PROVIDERS() });
    await user.click(screen.getByRole('button', { name: /add user/i }));
    await waitFor(() => screen.getByTestId('form-panel'));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() =>
      expect(screen.queryByTestId('form-panel')).not.toBeInTheDocument()
    );
  });

  // ── Search / filter ─────────────────────────────────────────────────────────

  it('renders search input', async () => {
    await render(UserDashboardComponent, { providers: DEFAULT_PROVIDERS() });
    expect(screen.getByPlaceholderText(/search users/i)).toBeInTheDocument();
  });

  // ── WebSocket status indicator ──────────────────────────────────────────────

  it('renders ws-status indicator', async () => {
    await render(UserDashboardComponent, { providers: DEFAULT_PROVIDERS() });
    expect(screen.getByTestId('ws-status')).toBeInTheDocument();
  });

  it('displays "connected" ws status when WS is connected', async () => {
    const wsService = buildMockWsService('connected');
    await render(UserDashboardComponent, { providers: DEFAULT_PROVIDERS(wsService) });
    const indicator = screen.getByTestId('ws-status');
    await waitFor(() => expect(indicator).toHaveAttribute('data-status', 'connected'));
  });

  it('displays "disconnected" ws status when WS is disconnected', async () => {
    const wsService = buildMockWsService('disconnected');
    await render(UserDashboardComponent, { providers: DEFAULT_PROVIDERS(wsService) });
    const indicator = screen.getByTestId('ws-status');
    await waitFor(() => expect(indicator).toHaveAttribute('data-status', 'disconnected'));
  });

  // ── Live WebSocket updates ──────────────────────────────────────────────────

  it('updates user row when USER_UPDATED message received', async () => {
    const wsService = buildMockWsService();
    await render(UserDashboardComponent, { providers: DEFAULT_PROVIDERS(wsService) });
    await waitFor(() => screen.getByText('Alice'));

    wsService._messages$.next({
      type: 'USER_UPDATED',
      payload: { id: 1, name: 'Alice (Updated)', email: 'alice@example.com', role: 'admin', status: 'active' },
    });

    await waitFor(() => expect(screen.getByText('Alice (Updated)')).toBeInTheDocument());
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('adds new row when USER_CREATED message received', async () => {
    const wsService = buildMockWsService();
    await render(UserDashboardComponent, { providers: DEFAULT_PROVIDERS(wsService) });
    await waitFor(() => screen.getByText('Alice'));

    wsService._messages$.next({
      type: 'USER_CREATED',
      payload: { id: 99, name: 'Dan', email: 'dan@example.com', role: 'viewer', status: 'active' },
    });

    await waitFor(() => expect(screen.getByText('Dan')).toBeInTheDocument());
  });

  it('removes row when USER_DELETED message received', async () => {
    const wsService = buildMockWsService();
    await render(UserDashboardComponent, { providers: DEFAULT_PROVIDERS(wsService) });
    await waitFor(() => screen.getByText('Bob'));

    wsService._messages$.next({ type: 'USER_DELETED', payload: { id: 2 } });

    await waitFor(() => expect(screen.queryByText('Bob')).not.toBeInTheDocument());
  });
});
