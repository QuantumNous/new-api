import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.ui.test.ts', 'src/**/*.ui.test.tsx'],
    setupFiles: ['./src/vitest-setup.ts'],
  },
});
