import reactPlugin from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [reactPlugin()],
  // TODO: For now, `pnpm dev` does not do the HMR when we update RHF source code.
  // It requires to restart the dev server (with --force flag).
  // This related to an open issue from Vite https://github.com/vitejs/vite/issues/4533
  // In Vite docs, they mention a workaround but it might not work.
  // https://vitejs.dev/guide/dep-pre-bundling.html#monorepos-and-linked-dependencies
  // So, for now, after updating RHF source code, please restart the `pnpm dev` for the update to take effect.
  server: {
    port: 3000,
  },
});
