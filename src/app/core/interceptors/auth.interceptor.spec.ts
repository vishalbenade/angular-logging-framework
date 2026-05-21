import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

describe('AuthInterceptor', () => {
  let httpClient:  HttpClient;
  let httpMock:    HttpTestingController;
  let authService: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        AuthService,
      ],
    });

    httpClient  = TestBed.inject(HttpClient);
    httpMock    = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  // ── Token attachment ────────────────────────────────────────────────────────

  it('attaches Authorization header when token exists', () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('valid-jwt-token');

    httpClient.get('/api/users').subscribe();

    const req = httpMock.expectOne('/api/users');
    expect(req.request.headers.get('Authorization')).toBe('Bearer valid-jwt-token');
    req.flush([]);
  });

  it('does not add Authorization header when no token is stored', () => {
    vi.spyOn(authService, 'getToken').mockReturnValue(null);

    httpClient.get('/api/users').subscribe();

    const req = httpMock.expectOne('/api/users');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  // ── 401 handling and token refresh ─────────────────────────────────────────

  it('refreshes token silently on 401 and retries original request', () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('expired-token');
    const setTokenSpy = vi.spyOn(authService, 'setToken');

    let result: unknown;
    httpClient.get('/api/users').subscribe(r => (result = r));

    // Original request gets 401
    const firstReq = httpMock.expectOne('/api/users');
    expect(firstReq.request.headers.get('Authorization')).toBe('Bearer expired-token');
    firstReq.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    // Interceptor fires the refresh call
    const refreshReq = httpMock.expectOne('/api/auth/refresh');
    expect(refreshReq.request.method).toBe('POST');
    refreshReq.flush({ token: 'new-jwt-token' });

    // Retried request with new token
    const retryReq = httpMock.expectOne('/api/users');
    expect(retryReq.request.headers.get('Authorization')).toBe('Bearer new-jwt-token');
    retryReq.flush([{ id: 1, name: 'Alice' }]);

    expect(setTokenSpy).toHaveBeenCalledWith('new-jwt-token');
    expect(result).toEqual([{ id: 1, name: 'Alice' }]);
  });

  it('calls logout when token refresh returns 401', () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('expired-token');
    const logoutSpy = vi.spyOn(authService, 'logout').mockImplementation(() => {});

    httpClient.get('/api/users').subscribe({ error: () => {} });

    httpMock.expectOne('/api/users').flush(
      {}, { status: 401, statusText: 'Unauthorized' }
    );
    httpMock.expectOne('/api/auth/refresh').flush(
      {}, { status: 401, statusText: 'Unauthorized' }
    );

    expect(logoutSpy).toHaveBeenCalledOnce();
  });

  it('does not intercept /api/auth/refresh endpoint (prevents infinite loop)', () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('expired-token');

    httpClient.post('/api/auth/refresh', {}).subscribe({ error: () => {} });

    const req = httpMock.expectOne('/api/auth/refresh');
    req.flush({}, { status: 401, statusText: 'Unauthorized' });

    // No additional refresh request should be made
    httpMock.expectNone('/api/auth/refresh');
  });

  // ── Non-401 errors ──────────────────────────────────────────────────────────

  it('propagates 403 errors without attempting refresh', () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('valid-token');
    const logoutSpy = vi.spyOn(authService, 'logout').mockImplementation(() => {});

    httpClient.delete('/api/users/1').subscribe({ error: err => {
      expect(err.status).toBe(403);
    }});

    httpMock.expectOne('/api/users/1').flush(
      { message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' }
    );

    expect(logoutSpy).not.toHaveBeenCalled();
    httpMock.expectNone('/api/auth/refresh');
  });

  it('propagates 500 errors without attempting refresh', () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('valid-token');

    httpClient.get('/api/users').subscribe({ error: err => {
      expect(err.status).toBe(500);
    }});

    httpMock.expectOne('/api/users').flush('', { status: 500, statusText: 'Server Error' });
    httpMock.expectNone('/api/auth/refresh');
  });
});
