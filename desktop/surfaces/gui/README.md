# coworker GUI (React + Tauri)

A thin client of the coworker server (OpenAI-compatible API + WS event/approval stream).
Same codebase runs in a browser (dev) and as the OpenWorker desktop app.

## First time: bootstrap the Python backend

A fresh checkout has no server to run — create the venv both flows below expect:

```bash
bash platform/packaging/setup_dev_env.sh   # → platform/.venv (server + this repo's aisuite)
```

## Run it (browser, two terminals)

1. **Start the server** (needs a model key, e.g. `OPENAI_API_KEY`, in the environment —
   or add one later in the app's Settings):
   ```bash
   cd platform
   ./.venv/bin/openworker-server --cwd /path/to/your/project --port 8765
   ```
2. **Start the UI:**
   ```bash
   cd platform/surfaces/gui
   npm install      # first time
   npm run dev      # → http://localhost:5173
   ```

Open http://localhost:5173. The UI talks to `http://127.0.0.1:8765` (override with
`VITE_COWORKER_HTTP` / `VITE_COWORKER_WS`).

## Run the desktop app from source

The Tauri shell wraps the same UI and supervises the Python server itself — no separate
terminal. It needs the Rust toolchain (`rustup`) plus the venv from the bootstrap step;
in dev it finds the server at `platform/.venv/bin/openworker-server` automatically (a
packaged sidecar binary is only produced by the release scripts in `platform/packaging/`).

```bash
cd platform/surfaces/gui
npm install        # first time
npm run tauri dev  # builds the shell, launches the window, starts the server
```

## Tests

```bash
npx tsc --noEmit && npx vitest run   # typecheck + unit
npx playwright test                  # hermetic e2e (mocked /v1 + WS, no Python needed)
```
