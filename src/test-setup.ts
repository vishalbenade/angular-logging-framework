import '@testing-library/jest-dom';
import 'zone.js';

// Angular 19 modern testing setup — handles templateUrl/styleUrl resolution
import { setupZoneTestEnv } from 'zone.js/testing';

setupZoneTestEnv({
  errorOnUnknownElements: false,
  errorOnUnknownProperties: false,
});

import { server } from './mocks/server';
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
