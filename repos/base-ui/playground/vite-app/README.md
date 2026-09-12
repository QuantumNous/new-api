# Base UI Vite playground

A small Vite + React app used for local experimentation and performance benchmarks against the Base UI source in this repo.

## Usage

### Dev mode

```bash
pnpm dev
```

### Production mode

```bash
pnpm build
pnpm serve
```

### Profiling build

This app supports a profiling build that aliases `react-dom/client` to `react-dom/profiling`.
This enables React Performance Tracks in Chrome Developer Tools profiler.

```bash
pnpm build:profile
pnpm serve
```

## React Performance Tracks

React can annotate the browser Performance panel with scheduling, commit, and component timing tracks in development and profiling builds. To use it:

1. Install the React DevTools browser extension.
2. Use the profiling build above (or `pnpm -C playground/vite-app dev`) and open the app in a Chromium-based browser.
3. Open DevTools > Performance, start a recording, then interact with the app.
4. Look for the React tracks in the timeline.

Reference: https://react.dev/reference/dev-tools/react-performance-tracks

## Deployment

The playground is deployed alongside the main docs.
`pnpm docs:build` in the repo root builds the playground and copies the output to the Next.js export directory.
The playground is then available under `/vite-playground`.
