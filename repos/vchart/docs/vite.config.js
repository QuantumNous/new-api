import pkg from '../packages/vchart/package.json';
import * as path from 'path';
import react from '@vitejs/plugin-react';

export default {
  optimizeDeps: {},
  server: {
    host: '0.0.0.0',
    port: 3020,
    https: !!process.env.HTTPS,
    open: true,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  define: {
    __DEV__: true,
    __VERSION__: JSON.stringify(pkg.version)
  },
  resolve: {
    alias: {
      '@visactor/vchart': path.resolve('../packages/vchart/src/index.ts'),
      '@visactor/vchart-extension': path.resolve('../packages/vchart-extension/src/index.ts'),
      '@visactor/react-vchart': path.resolve('../packages/react-vchart/src/index.ts'),
      '@visactor/openinula-vchart': path.resolve('../packages/openinula-vchart/src/index.ts'),
      '@visactor/vutils-extension': path.resolve('../packages/vutils-extension/src/index.ts'),
      '@internal/story-player': path.resolve('../tools/story-player/src/index.ts')
    }
  },
  plugins: [react()]
};
