/**
 * Runs once before every Vitest spec file.
 * Order matters — zone must be set up before Angular TestBed is initialized.
 */

// 1. Extends expect() with DOM matchers:
//    toBeInTheDocument(), toBeVisible(), toBeDisabled(), toHaveTextContent() etc.
import '@testing-library/jest-dom';

// 2. Zone.js test adapter — lets Angular track async operations in tests.
//    Must be imported before getTestBed / BrowserDynamicTestingModule.
import 'zone.js';
import 'zone.js/testing';

// 3. Bootstrap Angular's test environment (runs once globally)
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
  { teardown: { destroyAfterEach: true } }
);

// 4. MSW Node server — intercepts HTTP at Node layer (no browser needed)
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
