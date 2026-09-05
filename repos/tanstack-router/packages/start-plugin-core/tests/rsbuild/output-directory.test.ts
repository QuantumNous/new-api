import { describe, expect, test } from 'vitest'
import {
  createRsbuildEnvironmentPlan,
  resolveRsbuildOutputDirectory,
} from '../../src/rsbuild/planning'

describe('resolveRsbuildOutputDirectory', () => {
  test('uses explicit environment distPath string', () => {
    expect(
      resolveRsbuildOutputDirectory({
        distPath: 'custom/client',
        rootDistPath: 'build',
        fallback: 'dist/client',
        subdirectory: 'client',
      }),
    ).toBe('custom/client')
  })

  test('uses explicit environment distPath root object', () => {
    expect(
      resolveRsbuildOutputDirectory({
        distPath: { root: 'custom/server' },
        rootDistPath: { root: 'build' },
        fallback: 'dist/server',
        subdirectory: 'server',
      }),
    ).toBe('custom/server')
  })

  test('derives environment directory from top-level string distPath', () => {
    expect(
      resolveRsbuildOutputDirectory({
        distPath: undefined,
        rootDistPath: 'build',
        fallback: 'dist/client',
        subdirectory: 'client',
      }),
    ).toBe('build/client')
  })

  test('derives environment directory from top-level root distPath object', () => {
    expect(
      resolveRsbuildOutputDirectory({
        distPath: undefined,
        rootDistPath: { root: 'build' },
        fallback: 'dist/server',
        subdirectory: 'server',
      }),
    ).toBe('build/server')
  })

  test('falls back to default directory when no distPath is configured', () => {
    expect(
      resolveRsbuildOutputDirectory({
        distPath: undefined,
        rootDistPath: undefined,
        fallback: 'dist/client',
        subdirectory: 'client',
      }),
    ).toBe('dist/client')
  })
})

describe('createRsbuildEnvironmentPlan client output', () => {
  const baseOptions = {
    root: '/app',
    entryAliases: {
      client: '/app/src/client.tsx',
      server: '/app/src/server.ts',
      start: '/app/src/start.ts',
      router: '/app/src/router.tsx',
      alias: {
        'virtual:tanstack-start-client-entry': '/app/src/client.tsx',
        'virtual:tanstack-start-server-entry': '/app/src/server.ts',
        '#tanstack-start-entry': '/app/src/start.ts',
        '#tanstack-router-entry': '/app/src/router.tsx',
      },
    },
    clientOutputDirectory: 'dist/client',
    serverOutputDirectory: 'dist/server',
    publicBase: '/_build/',
    serverFnProviderEnv: 'ssr',
  }

  test('sets client output.module from scriptFormat', () => {
    expect(
      createRsbuildEnvironmentPlan({
        ...baseOptions,
        scriptFormat: 'iife',
      }).environments.client!.output?.module,
    ).toBe(false)

    expect(
      createRsbuildEnvironmentPlan({
        ...baseOptions,
        scriptFormat: 'module',
      }).environments.client!.output?.module,
    ).toBe(true)
  })

  test('throws when client output.module conflicts with scriptFormat', () => {
    expect(() =>
      createRsbuildEnvironmentPlan({
        ...baseOptions,
        scriptFormat: 'iife',
        environmentOverrides: {
          client: {
            output: {
              module: true,
            },
          },
        },
      }),
    ).toThrow(
      'TanStack Start rsbuild.client.output controls environments.client.output.module',
    )
  })

  test('throws when shared output.module conflicts with scriptFormat', () => {
    expect(() =>
      createRsbuildEnvironmentPlan({
        ...baseOptions,
        scriptFormat: 'iife',
        environmentOverrides: {
          all: {
            output: {
              module: true,
            },
          },
        },
      }),
    ).toThrow(
      'TanStack Start rsbuild.client.output controls environments.client.output.module',
    )
  })
})
