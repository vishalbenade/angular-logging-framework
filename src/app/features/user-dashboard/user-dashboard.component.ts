import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { UserGridComponent } from '../user-grid/user-grid.component';
import { UserFormComponent } from '../user-form/user-form.component';
import { UserService } from '../../core/services/user.service';
import { WebSocketService, WsMessage, WsStatus } from '../../core/services/websocket.service';
import type { User } from '../../core/models/user.model';

@Component({
  selector: 'app-user-dashboard',
  standalone: true,
  imports: [UserGridComponent, UserFormComponent],
  templateUrl: './user-dashboard.component.html',
})
export class UserDashboardComponent implements OnInit, OnDestroy {
  private readonly userService = inject(UserService);
  private readonly wsService   = inject(WebSocketService);
  private readonly destroy$    = new Subject<void>();

  users:        User[]    = [];
  isLoading               = false;
  errorMessage            = '';
  showForm                = false;
  searchText              = '';
  wsStatus: WsStatus      = 'disconnected';

  ngOnInit(): void {
    this.loadUsers();
    this.subscribeToWsMessages();
    this.subscribeToWsStatus();
  }

  private loadUsers(): void {
    this.isLoading   = true;
    this.errorMessage = '';

    this.userService.getUsers().pipe(takeUntil(this.destroy$)).subscribe({
      next: (users) => {
        this.users     = users;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Failed to load users. Please try again.';
        this.isLoading    = false;
      },
    });
  }

  private subscribeToWsMessages(): void {
    this.wsService.messages$.pipe(takeUntil(this.destroy$)).subscribe((msg: WsMessage) => {
      if (msg.type === 'USER_UPDATED') {
        const payload = msg.payload as User;
        this.users = this.users.map(u => u.id === payload.id ? { ...u, ...payload } : u);
      } else if (msg.type === 'USER_CREATED') {
        this.users = [...this.users, msg.payload as User];
      } else if (msg.type === 'USER_DELETED') {
        const payload = msg.payload as { id: number };
        this.users = this.users.filter(u => u.id !== payload.id);
      }
    });
  }

  private subscribeToWsStatus(): void {
    this.wsService.status$.pipe(takeUntil(this.destroy$)).subscribe(
      status => (this.wsStatus = status)
    );
  }

  onSearch(event: Event): void {
    this.searchText = (event.target as HTMLInputElement).value;
  }

  onUserCreated(user: User): void {
    this.users    = [...this.users, user];
    this.showForm = false;
  }

  onRowSelected(user: User): void {
    // PII GUARD: only log the user id — never log cell values
    console.log('Row selected, user id:', user.id);
  }

  onRetry(): void {
    this.loadUsers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
