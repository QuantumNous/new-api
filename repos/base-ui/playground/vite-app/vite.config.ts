import path from 'node:path';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(() => {
  const isProfiling = process.env.REACT_PROFILING === '1' || process.env.REACT_PROFILING === 'true';
  const baseUrl = process.env.PLAYGROUND_BASE ?? '/';
  const outDir = process.env.PLAYGROUND_OUT_DIR ?? 'dist';
  const resolvedOutDir = path.isAbsolute(outDir) ? outDir : path.resolve(__dirname, outDir);

  return {
    base: baseUrl,
    plugins: [tailwindcss(), react()],
    build: {
      sourcemap: true,
      outDir: resolvedOutDir,
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        '@base-ui/react': path.resolve(__dirname, '..', '..', 'packages', 'react', 'src'),
        '@base-ui/utils': path.resolve(__dirname, '..', '..', 'packages', 'utils', 'src'),
        ...(isProfiling ? { 'react-dom/client': 'react-dom/profiling' } : {}),
        docs: path.resolve(__dirname, '..', '..', 'docs'),
      },
    },
    server: {
      fs: {
        // Allow serving Base UI source from the monorepo root.
        allow: [path.resolve(__dirname, '..', '..')],
      },
    },
  };
});
