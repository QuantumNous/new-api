import { defineConfig } from 'tsup';

const packageVersion = JSON.stringify(
  (await import('./package.json', { with: { type: 'json' } })).default.version,
);

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    target: 'es2022',
    dts: true,
    sourcemap: true,
    define: {
      __PACKAGE_VERSION__: packageVersion,
    },
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
    // the sandbox only installs the bridge's own deps (src/bridge/package.json),
    // so a bare import would not resolve there. The runtime SDKs the bridge
    // imports are installed in-sandbox and stay external.
    noExternal: ['@ai-sdk/harness'],
    external: [
      'deepagents',
      '@langchain/anthropic',
      '@langchain/core',
      '@langchain/langgraph',
      'ws',
      'zod',
    ],
    define: {
      __PACKAGE_VERSION__: packageVersion,
    },
  },
]);
