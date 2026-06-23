/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
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
