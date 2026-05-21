import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { NgZone } from '@angular/core';
import { WebSocketService, WsStatus } from './websocket.service';

/** Helper: retrieves the handler registered via addEventListener */
function getSocketHandler(
  mockSocket: Record<string, unknown>,
  event: string
): ((...args: unknown[]) => void) | undefined {
  const calls = (mockSocket['addEventListener'] as ReturnType<typeof vi.fn>).mock.calls;
  const found = calls.find(([e]) => e === event);
  return found ? found[1] as (...args: unknown[]) => void : undefined;
}

describe('WebSocketService', () => {
  let service:    WebSocketService;
  let mockSocket: Record<string, unknown>;
  let wsSpy:      ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockSocket = {
      send:            vi.fn(),
      close:           vi.fn(),
      addEventListener: vi.fn(),
      readyState:      WebSocket.OPEN,
    };

    // Replace global WebSocket with mock before service construction
    wsSpy = vi.spyOn(globalThis, 'WebSocket' as never)
      .mockImplementation(() => mockSocket as unknown as WebSocket);

    TestBed.configureTestingModule({ providers: [WebSocketService] });
    service = TestBed.inject(WebSocketService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    service.disconnect();
  });

  // ── Connection ─────────────────────────────────────────────────────────────

  it('sets status to "connecting" on construction', () => {
    let status: WsStatus | undefined;
    service.status$.subscribe(s => (status = s));
    expect(status).toBe('connecting');
  });

  it('sets status to "connected" when socket opens', () => {
    let status: WsStatus | undefined;
    service.status$.subscribe(s => (status = s));

    const openHandler = getSocketHandler(mockSocket, 'open');
    openHandler?.();

    expect(status).toBe('connected');
  });

  it('resets reconnectAttempts to 0 on successful open', () => {
    const openHandler = getSocketHandler(mockSocket, 'open');
    openHandler?.();
    // Verify reconnection counter reset by confirming next close triggers reconnect
    const closeHandler = getSocketHandler(mockSocket, 'close');
    closeHandler?.({ code: 1006 });
    // If attempts reset, a new WebSocket is created (called twice total)
    expect(wsSpy).toHaveBeenCalledTimes(2);
  });

  // ── Messaging ──────────────────────────────────────────────────────────────

  it('emits parsed messages received from server', () => new Promise<void>(done => {
    service.messages$.subscribe(msg => {
      expect(msg).toEqual({ type: 'USER_UPDATED', payload: { id: 1 } });
      done();
    });

    const messageHandler = getSocketHandler(mockSocket, 'message');
    messageHandler?.({
      data: JSON.stringify({ type: 'USER_UPDATED', payload: { id: 1 } }),
    });
  }));

  it('silently drops malformed (non-JSON) messages', () => {
    const nextSpy = vi.fn();
    service.messages$.subscribe(nextSpy);

    const messageHandler = getSocketHandler(mockSocket, 'message');
    messageHandler?.({ data: 'NOT_JSON{{{' });

    expect(nextSpy).not.toHaveBeenCalled();
  });

  it('sends JSON-serialised message when socket is open', () => {
    mockSocket['readyState'] = WebSocket.OPEN;
    service.send({ type: 'PING', payload: null });
    expect(mockSocket['send']).toHaveBeenCalledWith(
      JSON.stringify({ type: 'PING', payload: null })
    );
  });

  it('does not send when socket is not open', () => {
    mockSocket['readyState'] = WebSocket.CLOSED;
    service.send({ type: 'PING' });
    expect(mockSocket['send']).not.toHaveBeenCalled();
  });

  // ── Reconnection ───────────────────────────────────────────────────────────

  it('sets status to "disconnected" on abnormal close', () => {
    let status: WsStatus | undefined;
    service.status$.subscribe(s => (status = s));

    const closeHandler = getSocketHandler(mockSocket, 'close');
    closeHandler?.({ code: 1006 });

    expect(status).toBe('disconnected');
  });

  it('reconnects after abnormal close (code 1006)', () => {
    vi.useFakeTimers();
    const closeHandler = getSocketHandler(mockSocket, 'close');
    closeHandler?.({ code: 1006 });

    vi.advanceTimersByTime(1100); // base delay = 1000ms
    expect(wsSpy).toHaveBeenCalledTimes(2); // initial + 1 reconnect
    vi.useRealTimers();
  });

  it('does NOT reconnect on intentional close (code 1000)', () => {
    vi.useFakeTimers();
    const closeHandler = getSocketHandler(mockSocket, 'close');
    closeHandler?.({ code: 1000 });

    vi.advanceTimersByTime(5000);
    expect(wsSpy).toHaveBeenCalledTimes(1); // no reconnect
    vi.useRealTimers();
  });

  it('stops reconnecting after MAX_RECONNECT_ATTEMPTS', () => {
    vi.useFakeTimers();
    // Simulate 5 consecutive abnormal closes
    for (let i = 0; i < 5; i++) {
      const closeHandler = getSocketHandler(mockSocket, 'close');
      closeHandler?.({ code: 1006 });
      vi.advanceTimersByTime(60_000); // advance past all backoff delays
    }
    // 6th close should NOT trigger another reconnect
    const closeHandler = getSocketHandler(mockSocket, 'close');
    closeHandler?.({ code: 1006 });
    vi.advanceTimersByTime(60_000);

    // Should not exceed initial (1) + max (5) = 6
    expect(wsSpy).toHaveBeenCalledTimes(6);
    vi.useRealTimers();
  });

  // ── Disconnect ─────────────────────────────────────────────────────────────

  it('closes socket with code 1000 on disconnect()', () => {
    service.disconnect();
    expect(mockSocket['close']).toHaveBeenCalledWith(1000, 'Client disconnected');
  });

  it('does not reconnect after destroy', () => {
    vi.useFakeTimers();
    service.disconnect(); // destroyed = true

    const closeHandler = getSocketHandler(mockSocket, 'close');
    closeHandler?.({ code: 1006 });

    vi.advanceTimersByTime(10_000);
    expect(wsSpy).toHaveBeenCalledTimes(1); // no additional calls
    vi.useRealTimers();
  });
});
