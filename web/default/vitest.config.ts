/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// Unified config: DR-76 (skill-analytics) coverage + globals/setup, plus the
// @vitejs/plugin-react needed by DR-58's marketplace RTL component tests.
// jsdom is required (download-utils reads window.location; component tests render
// React). `@` alias mirrors tsconfig paths via resolve.alias.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-utils/setup.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/features/skill-analytics/**',
        'src/features/admin-skills/**',
        'src/routes/_authenticated/skills/admin/index.tsx',
      ],
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage/skill-analytics',
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
