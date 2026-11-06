import { defineConfig } from 'vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import viteReact from '@vitejs/plugin-react';

const config = defineConfig({
  plugins: [devtools(), tanstackStart(), viteReact(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
  },
});

export default config;
