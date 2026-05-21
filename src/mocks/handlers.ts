/**
 * SINGLE SOURCE OF TRUTH for all API mocks.
 * Shared between Vitest (Node), Playwright (browser), and local dev.
 */
import { http, HttpResponse } from 'msw';
import type { User, CreateUserDto } from '../app/core/models/user.model';

const mockUsers: User[] = [
  { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin',  status: 'active'   },
  { id: 2, name: 'Bob',   email: 'bob@example.com',   role: 'viewer', status: 'inactive' },
  { id: 3, name: 'Carol', email: 'carol@example.com', role: 'admin',  status: 'active'   },
];

let nextId = 4;

export const handlers = [

  http.get('/api/users', () =>
    HttpResponse.json([...mockUsers])
  ),

  http.get('/api/users/:id', ({ params }) => {
    const user = mockUsers.find(u => u.id === Number(params['id']));
    return user
      ? HttpResponse.json(user)
      : HttpResponse.json({ message: 'User not found' }, { status: 404 });
  }),

  http.post('/api/users', async ({ request }) => {
    const body = await request.json() as CreateUserDto;
    const newUser: User = {
      id: nextId++,
      name: body.name,
      email: body.email,
      role: body.role,
      status: 'active',
    };
    mockUsers.push(newUser);
    return HttpResponse.json(newUser, { status: 201 });
  }),

  http.put('/api/users/:id', async ({ params, request }) => {
    const idx = mockUsers.findIndex(u => u.id === Number(params['id']));
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    const body = await request.json() as Partial<CreateUserDto>;
    mockUsers[idx] = { ...mockUsers[idx], ...body };
    return HttpResponse.json(mockUsers[idx]);
  }),

  // Intentionally 403 — used to test error-state UI
  http.delete('/api/users/:id', () =>
    HttpResponse.json({ message: 'Forbidden — admin action required' }, { status: 403 })
  ),

  http.post('/api/auth/refresh', () =>
    HttpResponse.json({ token: 'refreshed-jwt-token-mock' })
  ),
];
