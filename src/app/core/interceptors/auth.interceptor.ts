import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Functional HTTP interceptor (Angular 15+ style).
 * Responsibilities:
 *   1. Attaches Bearer token to every outgoing request.
 *   2. On 401, silently refreshes the token and retries once.
 *   3. On refresh failure, calls logout() and propagates the error.
 *
 * Registered in app.config.ts via provideHttpClient(withInterceptors([authInterceptor])).
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const authService = inject(AuthService);
  const token       = authService.getToken();

  // Clone the request with Authorization header if a token exists
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Only handle 401 — and don't intercept the refresh endpoint itself
      if (error.status === 401 && !req.url.includes('/api/auth/refresh')) {
        return authService.refreshToken().pipe(
          switchMap(({ token: newToken }) => {
            // Retry the original request with the new token
            const retryReq = req.clone({
              setHeaders: { Authorization: `Bearer ${newToken}` },
            });
            return next(retryReq);
          }),
          catchError(refreshError => {
            // Refresh also failed — force logout
            authService.logout();
            return throwError(() => refreshError);
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};
