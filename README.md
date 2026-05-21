# Angular 19 Production Test Framework

A complete, production-grade testing framework for Angular 19 applications.

## Stack

| Layer              | Tool                           | Why                                                        |
|--------------------|--------------------------------|------------------------------------------------------------|
| Unit + Integration | Vitest + Angular Testing Library | 300ms cold start, native ESM, HMR-aware watch mode       |
| API Mocking        | MSW (Mock Service Worker)      | Single handlers.ts shared between Vitest, Playwright, dev |
| E2E                | Playwright (Chromium)          | Real browser — virtual scroll, WS, drag/drop, downloads   |
| Coverage           | V8 via Vitest                  | Node-native, no Babel transform needed                     |
| CI                 | GitHub Actions                 | Parallel jobs, artifact uploads, browser caching          |

---

## Getting Started

### 1. Create the Angular project

```bash
ng new my-app --standalone --routing --style=css
cd my-app
```

### 2. Copy framework files

Copy the contents of this zip into your project root. The structure is:

```
src/
├── test-setup.ts                         # Vitest + Angular + MSW bootstrap
├── mocks/
│   ├── handlers.ts                       # ← SINGLE SOURCE OF TRUTH for all API mocks
│   ├── server.ts                         # MSW Node server (used by Vitest)
│   └── browser.ts                        # MSW Service Worker (used by Playwright/dev)
├── testing/
│   └── ag-grid.harness.ts                # Reusable AG Grid v33 test utility
├── environments/
│   ├── environment.ts                    # production (useMocks: false)
│   └── environment.test.ts              # test / dev (useMocks: true)
└── app/
    ├── core/
    │   ├── models/user.model.ts
    │   ├── services/
    │   │   ├── auth.service.ts
    │   │   ├── user.service.ts + spec     # 9 tests
    │   │   └── websocket.service.ts + spec # 12 tests
    │   └── interceptors/
    │       └── auth.interceptor.ts + spec  # 6 tests
    └── features/
        ├── user-dashboard/               # integration spec (15 tests)
        ├── user-form/                    # unit spec (18 tests)
        └── user-grid/                    # unit spec (17 tests)
e2e/
├── pages/user-dashboard.page.ts          # Page Object Model
└── specs/
    ├── user-grid.spec.ts                 # 8 tests — sorting, filter, sticky header
    ├── user-form.spec.ts                 # 10 tests — validation, submit, cancel
    ├── websocket.spec.ts                 # 7 tests — live updates, reconnection
    └── auth.spec.ts                      # 6 tests — refresh, logout, loop guard
.github/workflows/test.yml               # Parallel CI: Vitest + Playwright
```

### 3. Install dependencies

```bash
npm install
npx playwright install chromium
```

### 4. Generate MSW Service Worker

```bash
npx msw init public/ --save
```

---

## Running Tests

```bash
# Vitest — watch mode (fastest local dev loop)
npm run test:watch

# Vitest — single run
npm test

# Vitest — with V8 coverage report
npm run test:coverage

# Vitest — interactive UI (browser-based test explorer)
npm run test:ui

# Playwright E2E — headless
npm run e2e

# Playwright E2E — interactive UI mode
npm run e2e:ui

# Playwright — view last HTML report
npm run e2e:report
```

---

## Coverage Thresholds

Configured in `vitest.config.ts`. Build fails if coverage drops below:

| Metric     | Threshold |
|------------|-----------|
| Branches   | 80%       |
| Functions  | 85%       |
| Lines      | 85%       |
| Statements | 85%       |

---

## Architecture Decisions

### Why Vitest over Jest?

| Feature         | Vitest          | Jest              |
|-----------------|-----------------|-------------------|
| Cold start      | ~300ms          | ~1–2s             |
| Watch mode      | HMR-aware       | Full re-run       |
| ESM support     | Native          | Transform required |
| API             | Same (vi = jest) | N/A              |
| Angular support | @analogjs/vitest-angular | jest-preset-angular |

### Why one `handlers.ts`?

MSW handlers run in Node (Vitest) and in the browser (Playwright via Service Worker).
A single file means:
- Add a new API endpoint once
- All test layers pick it up automatically
- Per-test overrides via `server.use(...)` reset after each test

### Why AgGridHarness instead of DOM queries?

AG Grid v33 renders virtual rows — DOM nodes outside the viewport are destroyed.
The harness uses `GridApi.getDisplayedRowAtIndex()` which returns data regardless
of whether the DOM node exists. If AG Grid renames an API method, fix it here once.

### Why Playwright for WebSocket tests?

`jsdom` has no real WebSocket lifecycle. `page.routeWebSocket()` intercepts
at the Chromium network layer, allowing you to:
- Drop connections mid-session
- Send messages at precise timings
- Verify UI state during reconnection gaps

---

## Per-Test MSW Override Pattern

```typescript
import { server } from '../../../mocks/server';
import { http, HttpResponse } from 'msw';

it('shows error state on 503', async () => {
  // Override for THIS test only
  server.use(
    http.get('/api/users', () =>
      HttpResponse.json({ message: 'Service Unavailable' }, { status: 503 })
    )
  );
  // ... test body
  // Handler automatically removed in afterEach → server.resetHandlers()
});
```

---

## CI Pipeline

Two parallel jobs in `.github/workflows/test.yml`:

```
push/PR
    ├── unit-integration (Vitest + coverage) ─┐
    └── e2e (Playwright Chromium)             ─┴── all-tests-pass (required check)
```

Artifacts uploaded on every run:
- `vitest-coverage` — HTML coverage report (14 days)
- `playwright-report` — HTML test report (14 days)
- `playwright-traces` — execution traces on failure (7 days)
