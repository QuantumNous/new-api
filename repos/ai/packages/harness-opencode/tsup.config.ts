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
    entry: {
      'bridge/index': 'src/bridge/index.ts',
      'bridge/host-tool-mcp': 'src/bridge/host-tool-mcp.ts',
    },
    format: ['esm'],
    target: 'es2022',
    outExtension: () => ({ js: '.mjs' }),
    dts: false,
    sourcemap: true,
    platform: 'node',
    noExternal: ['@ai-sdk/harness'],
    external: [
      '@opencode-ai/sdk/v2',
      '@modelcontextprotocol/sdk',
      'opencode-ai',
      'ws',
      'zod',
    ],
  },
]);
