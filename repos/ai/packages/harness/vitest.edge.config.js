import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'edge-runtime',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    // The sandbox bridge runtime is node-only (binds a real WebSocket server
    // via `ws` + `node:http`); its test cannot run under edge-runtime.
    exclude: ['**/src/bridge/**', '**/node_modules/**'],
  },
});
