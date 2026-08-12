# Client Navigation Benchmarks

Cross-framework client-side navigation benchmarks for:

- `@tanstack/react-router`
- `@tanstack/solid-router`
- `@tanstack/vue-router`

## Layout

- `react/` - React benchmark + Vitest config
- `solid/` - Solid benchmark + Vitest config
- `vue/` - Vue benchmark + Vitest config

## Run

Run all benchmarks through Nx so dependency builds are part of the graph:

```bash
CI=1 NX_DAEMON=false pnpm nx run @benchmarks/client-nav:test:perf --outputStyle=stream --skipRemoteCache
```

Run framework-specific benchmarks:

```bash
CI=1 NX_DAEMON=false pnpm nx run @benchmarks/client-nav:test:perf:react --outputStyle=stream --skipRemoteCache
CI=1 NX_DAEMON=false pnpm nx run @benchmarks/client-nav:test:perf:solid --outputStyle=stream --skipRemoteCache
CI=1 NX_DAEMON=false pnpm nx run @benchmarks/client-nav:test:perf:vue --outputStyle=stream --skipRemoteCache
```

Run framework-specific flame benchmarks (10 second loop, profiled with `@platformatic/flame`, forced to `NODE_ENV=production`):

```bash
CI=1 NX_DAEMON=false pnpm nx run @benchmarks/client-nav:test:flame:react --outputStyle=stream --skipRemoteCache
CI=1 NX_DAEMON=false pnpm nx run @benchmarks/client-nav:test:flame:solid --outputStyle=stream --skipRemoteCache
CI=1 NX_DAEMON=false pnpm nx run @benchmarks/client-nav:test:flame:vue --outputStyle=stream --skipRemoteCache
```

Typecheck benchmark sources:

```bash
CI=1 NX_DAEMON=false pnpm nx run @benchmarks/client-nav:test:types --outputStyle=stream --skipRemoteCache
```
