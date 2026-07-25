import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, transformWithEsbuild } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const classicSrc = path.resolve(__dirname, '../classic/src');
const shims = path.resolve(__dirname, 'src/shims');

// classic 的 helpers/utils.jsx 及 helpers/index.js barrel 会传染 Semi/桌面依赖，
// 按"解析后的绝对路径"整模块替换为移动端 shim（antd-mobile 实现 + 拷贝的纯函数）。
const SHIM_MAP = {
  [path.join(classicSrc, 'helpers/index.js')]: path.join(
    shims,
    'classic-helpers.js',
  ),
  [path.join(classicSrc, 'helpers/utils.jsx')]: path.join(
    shims,
    'classic-utils.jsx',
  ),
};

// classic 源码里的裸包导入（sse.js/localforage 等）按 Node 规则从 classic 目录向上
// 找 node_modules——本地因 classic 装过依赖能碰巧解析，Docker 的 builder-mobile
// 阶段只拷源码不装 classic 依赖，会直接构建失败。统一改从 mobile 根解析，
// 本地与 CI 行为归一（mobile 的 package.json 必须包含复用链路的全部三方包）。
function classicBareImports() {
  return {
    name: 'classic-bare-imports',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || !importer.includes(`${path.sep}classic${path.sep}src${path.sep}`)) {
        return null;
      }
      if (
        source.startsWith('.') ||
        source.startsWith('/') ||
        source.startsWith('@classic') ||
        source.startsWith('@douyinfe') // 交给 semi-ui shim 的 alias 处理
      ) {
        return null;
      }
      return this.resolve(source, path.resolve(__dirname, 'index.html'), {
        skipSelf: true,
        ...options,
      });
    },
  };
}

function classicShims() {
  return {
    name: 'classic-shims',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer) return null;
      const resolved = await this.resolve(source, importer, {
        skipSelf: true,
        ...options,
      });
      if (resolved && SHIM_MAP[resolved.id]) {
        return SHIM_MAP[resolved.id];
      }
      return null;
    },
  };
}

export default defineConfig({
  base: '/m/',
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, 'src') },
      { find: '@classic', replacement: classicSrc },
      // 精确匹配：复用的 classic hooks 只允许用到 shim 导出的 Toast/Modal，
      // 未来若 classic 引入更多 Semi 组件，移动端构建会显式失败而非静默打包 Semi
      {
        find: /^@douyinfe\/semi-ui$/,
        replacement: path.join(shims, 'semi-ui.jsx'),
      },
    ],
    // 跨树 import ../classic/src 时防止解析到 classic/node_modules 的第二份依赖
    dedupe: [
      'react',
      'react-dom',
      'react-i18next',
      'i18next',
      'axios',
      'localforage',
    ],
  },
  plugins: [
    classicBareImports(),
    classicShims(),
    {
      // 与 classic 相同：classic 的 .js 文件可能含 JSX
      name: 'treat-js-files-as-jsx',
      async transform(code, id) {
        if (!/src\/.*\.js$/.test(id)) {
          return null;
        }
        return transformWithEsbuild(code, id, {
          loader: 'jsx',
          jsx: 'automatic',
        });
      },
    },
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'New API',
        short_name: 'New API',
        start_url: '/m/',
        scope: '/m/',
        display: 'standalone',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          { src: '/m/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/m/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        navigateFallback: '/m/index.html',
        // 鉴权数据一律不缓存；导航 fallback 不劫持接口路径
        navigateFallbackDenylist: [/^\/api\//, /^\/pg\//, /^\/v1\//, /^\/mj\//],
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-core': ['react', 'react-dom', 'react-router-dom'],
          'antd-mobile': ['antd-mobile', 'antd-mobile-icons'],
          i18n: ['i18next', 'react-i18next'],
          tools: ['axios', 'localforage', 'dayjs'],
        },
      },
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
        '.json': 'json',
      },
    },
  },
  server: {
    host: '0.0.0.0',
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/mj': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/pg': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/v1': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/audio-presets': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/playground-samples': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
