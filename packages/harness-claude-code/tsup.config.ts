import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    target: 'es2022',
    dts: true,
    sourcemap: true,
  },
  {
    entry: { 'bridge/index': 'src/bridge/index.ts' },
    format: ['esm'],
    target: 'es2022',
    outExtension: () => ({ js: '.mjs' }),
    dts: false,
    sourcemap: true,
    platform: 'node',
    // The shared bridge runtime (`@ai-sdk/harness/bridge`) must be INLINED —
    // the sandbox only installs the bridge's own deps, so a bare import would
    // not resolve there. tsup externalizes package.json deps by default, hence
    // the explicit override.
    noExternal: ['@ai-sdk/harness'],
    // SDK + MCP deps live inside the sandbox-installed node_modules; never
    // bundle them into bridge.mjs. ws and zod are also installed by the
    // bridge's pnpm install step so the host package's own copy is irrelevant.
    external: [
      '@anthropic-ai/claude-agent-sdk',
      '@anthropic-ai/claude-code',
      '@modelcontextprotocol/sdk',
      'ws',
      'zod',
    ],
  },
]);
