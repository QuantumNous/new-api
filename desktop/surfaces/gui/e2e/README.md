# E2E tests (Playwright)

End-to-end regression tests for the GUI. They drive the real app in Chromium but are **hermetic**:
every `/v1` request and the event WebSocket are mocked at the network layer, so tests need **no
Python backend**, run deterministically, and never mutate real state.

## Run

```bash
npm run e2e          # headless
npm run e2e:ui       # Playwright UI mode (watch/inspect)
npx playwright test e2e/settings.spec.ts   # a single spec
```

## Live smoke (not CI)

`npm run e2e:live` runs `e2e-live/` (separate `playwright.live.config.ts`) against the **real**
backend on :8765. Two flavors, both skip cleanly when the backend is down:

- **API-shape smoke** (`api-smoke.spec.ts`) — no model tokens, no creds. Asserts `/v1/health` and
  `/v1/providers` return the shapes the GUI reads, catching drift between the mocks and the real
  backend. Cheap enough to run anytime the sidecar is up.
- **Full vertical** (`fib.spec.ts`, …) — asks a fresh Cowork session to produce `fib.md` and
  verifies the file lands on disk. Needs a model configured, is nondeterministic, and costs a few
  tokens per run. Exercises the vertical the hermetic specs mock: model wiring, the tool/approval
  loop, file I/O, and WebSocket streaming.

The config (`playwright.config.ts`) starts the Vite dev server on port **5199** (dedicated, so it
won't clash with a running `npm run dev` on 5173) and reuses it if already up.

## How the mock works

`e2e/fixtures.ts` exports a `test` whose `page` has `mockApi()` installed before navigation:

- `page.route("**/v1/**", …)` dispatches by pathname + method to fixtures whose shapes mirror the
  real backend (captured from a live server). Unknown endpoints return an empty-but-valid body.
- Mutations are held in per-test in-memory state so they reflect through the real UI on re-fetch:
  sessions (archive/rename/delete), personas (enable/surface/delete — enable implies surface,
  matching the backend), inbox items + the routing binding, roots, channel subscriptions.
- The session WebSocket (`routeWebSocket`) is a **scripted fake agent** speaking the real
  `{type, data}` event protocol: `ready` on connect; `user_message` → `turn_start` → deltas →
  `assistant_message "Echo: <text>"` → `turn_done`; a message containing **"run a tool"** emits
  `tool_proposed` + `permission_required` and suspends until the client's `approval` decision
  arrives. This runs the production send/stream/approve code paths with zero model cost.
- Seed data worth knowing: the pinned session "Draft the launch note" is the newest (boot-resume
  target); 7 unpinned "Weekly plan N" cowork sessions exercise the sidebar peek cap; two pending
  Inbox items (approval on cowork, question on ops) drive the Inbox filters; `acme-notes` is a
  disabled non-builtin persona for enable/delete flows. Providers are seeded in three states
  (OpenAI configured+used, Anthropic configured-unused, Z AI unconfigured w/ prefilled endpoint) —
  `POST /v1/providers` flips `configured` on save, `/verify` fails on a key containing "bad". One
  automation ("Daily AI News") with a running run — `POST .../run` appends a run, `PATCH`/`DELETE`
  toggle and remove.

## Adding a spec

```ts
import { test, expect } from "./fixtures";

test("…", async ({ page }) => {
  await page.goto("/");
  // interact + assert
});
```

If a flow reads a new endpoint, add its fixture + a route branch in `fixtures.ts` — the catch-all
returns `{}`, which will crash components that expect arrays (e.g. persona `recommends`). Prefer
`getByRole`, but note some controls (the Sources bar, the ✕ remove) take their accessible name from
inner content — target those with `getByTitle`/`getByLabel`.
```
