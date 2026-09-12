import * as path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const shouldDisableWorkspaceAliases = Boolean(process.env.MUI_DISABLE_WORKSPACE_ALIASES);

export default defineConfig({
  mode: process.env.NODE_ENV || 'development',
  plugins: [react()],
  resolve: {
    alias: {
      ...(shouldDisableWorkspaceAliases
        ? undefined
        : {
            '@base-ui/react': path.join(process.cwd(), 'packages/react/src'),
            '@base-ui/utils': path.join(process.cwd(), 'packages/utils/src'),
          }),
      './fonts': path.join(process.cwd(), '/docs/src/css/fonts'),
      docs: path.join(process.cwd(), '/docs'),
      stream: '',
      zlib: '',
    },
  },
  build: { outDir: 'build', chunkSizeWarningLimit: 9999 },
});
