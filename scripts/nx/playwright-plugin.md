# Playwright E2E Inference (Modes + Shards)

Use `scripts/nx/playwright-plugin.ts` to infer Playwright e2e targets from
`package.json` metadata.

The plugin supports two metadata styles:

- `nx.metadata.playwrightModes` (recommended)
- `nx.metadata.playwrightShards` (legacy, still supported)

When `playwrightModes` is present, it takes precedence.

## 1. Configure `playwrightModes` in `package.json`

```json
{
  "name": "tanstack-react-start-e2e-basic",
  "nx": {
    "metadata": {
      "playwrightModes": [
        { "toolchain": "vite", "mode": "ssr" },
        { "toolchain": "vite", "mode": "spa", "shards": 4 },
        { "toolchain": "vite", "mode": "prerender", "shards": 4 },
        { "toolchain": "vite", "mode": "preview" }
      ]
    }
  }
}
```

Supported modes:

- `ssr`
- `spa`
- `prerender`
- `preview`

`shards` is optional and defaults to `1`.

Supported toolchains:

- `vite`

## 2. What targets are generated

For each `{ toolchain, mode }` entry, the plugin generates:

- `build:e2e--<toolchain>-<mode>`
- `test:e2e--<toolchain>-<mode>`

If `shards > 1`, it also generates:

- `test:e2e--<toolchain>-<mode>--shard-1-of-N` ... `--shard-N-of-N`
- `test:e2e--<toolchain>-<mode>` as a parent noop target depending on all shards

Finally, it generates:

- `test:e2e` as a parent noop target depending on every mode target

## 3. Environment variables injected by inferred targets

Each inferred `build:e2e:*` and `test:e2e:*` target sets:

- `MODE=<mode>`
- `TOOLCHAIN=<toolchain>`
- `E2E_TOOLCHAIN=<toolchain>`
- `E2E_DIST=dist-<toolchain>-<mode>`
- `E2E_DIST_DIR=dist-<toolchain>-<mode>`

Each inferred `test:e2e:*` target also sets:

- `E2E_PORT_KEY=<package-name>-<toolchain>-<mode>`
- For shard targets: `E2E_PORT_KEY=<package-name>-<toolchain>-<mode>-shard-<index>-of-<count>`

## 4. Build behavior and webServer command

Each inferred e2e target depends on the inferred `build:e2e--<toolchain>-<mode>`
target, which runs:

```sh
vite build && tsc --noEmit
```

with the mode/toolchain env above.

This command is intentionally fixed (it does not call `pnpm build`). This avoids
accidentally selecting the wrong build path in projects that include multiple
toolchains.

The inferred build target uses standard production inputs and explicit mode-
specific outputs (`dist-<toolchain>-<mode>`). Mode env values are passed through
the target command env, so they do not need to be duplicated as target input
env hashes.

Because of this, Playwright `webServer.command` should only start the app.

Good:

```ts
webServer: {
  command: `PORT=${PORT} pnpm start`,
  url: baseURL,
}
```

For preview mode, pass the inferred dist folder:

```ts
const distDir = process.env.E2E_DIST_DIR ?? 'dist'

webServer: {
  command: `pnpm preview --outDir ${distDir} --port ${PORT}`,
  url: baseURL,
}
```

Avoid:

```ts
webServer: {
  command: `MODE=spa pnpm build && PORT=${PORT} pnpm start`,
  url: baseURL,
}
```

## 5. Use `E2E_PORT_KEY` for all server ports

If your setup uses `getTestServerPort`, `getDummyServerPort`,
`e2eStartDummyServer`, or `e2eStopDummyServer`, use
`process.env.E2E_PORT_KEY` first.

```ts
import { getTestServerPort } from '@tanstack/router-e2e-utils'
import packageJson from './package.json' with { type: 'json' }

const e2ePortKey = process.env.E2E_PORT_KEY ?? packageJson.name
const PORT = await getTestServerPort(e2ePortKey)
```

Dummy server setup/teardown should use the same key:

```ts
await e2eStartDummyServer(process.env.E2E_PORT_KEY ?? packageJson.name)
await e2eStopDummyServer(process.env.E2E_PORT_KEY ?? packageJson.name)
```

## 6. Clean stale port files once per Playwright run

If the project allocates ports through `@tanstack/router-e2e-utils`, clean stale
`port-*.txt` files before resolving the port.

Important: do this only in the main Playwright config load. Playwright loads the
config more than once, and unconditional cleanup can remap the port after the
web server has already started.

```ts
import fs from 'node:fs'
import packageJson from './package.json' with { type: 'json' }

const e2ePortKey = process.env.E2E_PORT_KEY ?? packageJson.name

if (process.env.TEST_WORKER_INDEX === undefined) {
  for (const portFile of [
    `port-${e2ePortKey}.txt`,
    `port-${e2ePortKey}_start.txt`,
    `port-${e2ePortKey}-external.txt`,
  ]) {
    fs.rmSync(portFile, { force: true })
  }
}
```

Include the `*_start` file only if your test setup allocates a separate
`START_PORT` key.

Avoid broad cleanup such as `rm -rf port*.txt` in shared shard runs.

## 7. Run inferred targets

Examples:

```sh
pnpm nx run tanstack-react-start-e2e-basic:test:e2e--vite-ssr
pnpm nx run tanstack-react-start-e2e-basic:test:e2e--vite-spa--shard-1-of-4
pnpm nx run tanstack-react-start-e2e-basic:test:e2e
```

## Legacy fallback: `playwrightShards`

If `playwrightModes` is not configured, the plugin still supports:

```json
{
  "nx": {
    "metadata": {
      "playwrightShards": 6
    }
  }
}
```

This generates legacy shard targets under `test:e2e--shard-...` plus a parent
`test:e2e` target.
