import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly http      = inject(HttpClient);
  private readonly router    = inject(Router);

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  clearToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  refreshToken(): Observable<{ token: string }> {
    return this.http
      .post<{ token: string }>('/api/auth/refresh', {})
      .pipe(tap(({ token }) => this.setToken(token)));
  }

  logout(): void {
    this.clearToken();
    this.router.navigate(['/login']);
  }
}
