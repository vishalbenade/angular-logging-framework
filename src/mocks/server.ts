/**
 * MSW Node server — used exclusively by Vitest (Node.js environment).
 * Intercepts HTTP at Node's http/https module layer.
 * Lifecycle managed in src/test-setup.ts.
 */
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
