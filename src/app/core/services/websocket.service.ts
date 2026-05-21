import { Injectable, NgZone, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

export type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export interface WsMessage {
  type:     string;
  payload?: unknown;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private socket:           WebSocket | null = null;
  private reconnectTimer:   ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private destroyed         = false;

  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly BASE_DELAY_MS          = 1000;

  private readonly ngZone = inject(NgZone);

  private readonly messagesSubject = new Subject<WsMessage>();
  private readonly statusSubject   = new BehaviorSubject<WsStatus>('disconnected');

  /** Stream of parsed messages received from the server. */
  readonly messages$: Observable<WsMessage> = this.messagesSubject.asObservable();

  /** Current connection status. Drives the UI status indicator. */
  readonly status$: Observable<WsStatus> = this.statusSubject.asObservable();

  constructor() {
    this.connect();
  }

  connect(): void {
    if (this.destroyed) return;

    this.statusSubject.next(
      this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting'
    );

    // Run outside NgZone — WebSocket events must not trigger Angular
    // change detection on every message (performance critical for grids)
    this.ngZone.runOutsideAngular(() => {
      this.socket = new WebSocket(environment.wsUrl);
      this.attachListeners();
    });
  }

  private attachListeners(): void {
    if (!this.socket) return;

    this.socket.addEventListener('open', () => {
      this.ngZone.run(() => {
        this.reconnectAttempts = 0;
        this.statusSubject.next('connected');
      });
    });

    this.socket.addEventListener('message', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as WsMessage;
        // Re-enter NgZone so Angular picks up grid/state changes
        this.ngZone.run(() => this.messagesSubject.next(data));
      } catch {
        // Silently drop malformed messages
      }
    });

    this.socket.addEventListener('close', (event: CloseEvent) => {
      this.ngZone.run(() => {
        this.statusSubject.next('disconnected');
        // code 1000 = intentional close — don't reconnect
        if (!this.destroyed && event.code !== 1000) {
          this.scheduleReconnect();
        }
      });
    });

    this.socket.addEventListener('error', () => {
      this.ngZone.run(() => this.statusSubject.next('disconnected'));
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) return;
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = this.BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  send(data: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  disconnect(): void {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close(1000, 'Client disconnected');
    this.socket = null;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
