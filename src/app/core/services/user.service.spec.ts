import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UserService } from './user.service';

describe('UserService', () => {
  let service:  UserService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        UserService,
      ],
    });
    service  = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  // Asserts no unexpected HTTP requests were made during the test
  afterEach(() => httpMock.verify());

  describe('getUsers', () => {
    it('returns an array of users on success', () => {
      const mockData = [
        { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin',  status: 'active'   },
        { id: 2, name: 'Bob',   email: 'bob@example.com',   role: 'viewer', status: 'inactive' },
      ];

      service.getUsers().subscribe(users => {
        expect(users).toHaveLength(2);
        expect(users[0].name).toBe('Alice');
        expect(users[1].role).toBe('viewer');
      });

      const req = httpMock.expectOne('/api/users');
      expect(req.request.method).toBe('GET');
      req.flush(mockData);
    });

    it('propagates HTTP 500 error to subscriber', () => {
      service.getUsers().subscribe({
        next:  ()    => { throw new Error('should not emit'); },
        error: (err) => {
          expect(err.status).toBe(500);
          expect(err.statusText).toBe('Internal Server Error');
        },
      });

      httpMock.expectOne('/api/users').flush(
        'Server Error',
        { status: 500, statusText: 'Internal Server Error' }
      );
    });

    it('propagates HTTP 503 error to subscriber', () => {
      service.getUsers().subscribe({
        error: err => expect(err.status).toBe(503),
      });
      httpMock.expectOne('/api/users').flush('', { status: 503, statusText: 'Service Unavailable' });
    });
  });

  describe('getUserById', () => {
    it('fetches a single user by id', () => {
      const mockUser = { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin', status: 'active' };

      service.getUserById(1).subscribe(user => {
        expect(user.id).toBe(1);
        expect(user.name).toBe('Alice');
      });

      const req = httpMock.expectOne('/api/users/1');
      expect(req.request.method).toBe('GET');
      req.flush(mockUser);
    });

    it('propagates 404 when user not found', () => {
      service.getUserById(999).subscribe({
        error: err => expect(err.status).toBe(404),
      });
      httpMock.expectOne('/api/users/999').flush('', { status: 404, statusText: 'Not Found' });
    });
  });

  describe('createUser', () => {
    it('posts user DTO and returns created user with id', () => {
      const dto    = { name: 'Dan', email: 'dan@example.com', role: 'viewer' as const };
      const created = { id: 99, ...dto, status: 'active' as const };

      service.createUser(dto).subscribe(user => {
        expect(user.id).toBe(99);
        expect(user.name).toBe('Dan');
      });

      const req = httpMock.expectOne('/api/users');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush(created, { status: 201, statusText: 'Created' });
    });

    it('propagates 422 validation error', () => {
      service.createUser({ name: '', email: 'bad', role: 'viewer' }).subscribe({
        error: err => expect(err.status).toBe(422),
      });
      httpMock.expectOne('/api/users').flush('', { status: 422, statusText: 'Unprocessable Entity' });
    });
  });

  describe('updateUser', () => {
    it('puts updated fields and returns updated user', () => {
      const updated = { id: 1, name: 'Alice Updated', email: 'alice@example.com', role: 'admin' as const, status: 'active' as const };

      service.updateUser(1, { name: 'Alice Updated' }).subscribe(user => {
        expect(user.name).toBe('Alice Updated');
      });

      const req = httpMock.expectOne('/api/users/1');
      expect(req.request.method).toBe('PUT');
      req.flush(updated);
    });
  });

  describe('deleteUser', () => {
    it('sends DELETE request and completes on 403 (expected mock)', () => {
      service.deleteUser(1).subscribe({
        error: err => expect(err.status).toBe(403),
      });
      httpMock.expectOne('/api/users/1').flush('', { status: 403, statusText: 'Forbidden' });
    });
  });
});
