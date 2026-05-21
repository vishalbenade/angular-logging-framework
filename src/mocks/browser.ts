/**
 * MSW browser worker — used when Angular runs in a real browser.
 * Registers a Service Worker that intercepts fetch() calls.
 * Started in src/main.ts when environment.useMocks is true.
 */
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
