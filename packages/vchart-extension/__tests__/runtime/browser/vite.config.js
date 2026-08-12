import * as path from 'path';
import localConf from './vite.config.local';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill';
import rollupNodePolyFill from 'rollup-plugin-node-polyfills';

export default {
  server: {
    host: '0.0.0.0',
    port: localConf.port || 3000,
    https: !!process.env.HTTPS,
    open: true
  },
  define: {
    __DEV__: true,
    __VERSION__: JSON.stringify(require('../../../package.json').version)
  },
  optimizeDeps: {
    esbuildOptions: {
      // Node.js global to browser globalThis
      define: {
        global: 'globalThis'
      },
      // Enable esbuild polyfill plugins
      plugins: [
        NodeGlobalsPolyfillPlugin({
          process: true,
          buffer: true
        }),
        NodeModulesPolyfillPlugin()
      ]
    }
  },
  build: {
    rollupOptions: {
      plugins: [
        // Enable rollup polyfills plugin
        // used during production bundling
        rollupNodePolyFill()
      ]
    }
  },
  resolve: {
    ...localConf?.resolve,
    alias: {
      ...localConf?.resolve?.alias,
      '@visactor/vutils-extension': path.resolve(__dirname, '../../../../vutils-extension/src/index.ts'),
      '@visactor/vchart': path.resolve(__dirname, '../../../../vchart/src/index.ts')
    }
  }
};
