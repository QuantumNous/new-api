import path from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getConfig } from '../src'
import type { Config } from '../src'

describe('getConfig', () => {
  const testCases = [
    {
      name: 'inline config',
      inlineConfig: {
        target: 'solid',
        autoCodeSplitting: false,
        enableRouteGeneration: true,
      } as Partial<Config>,
      withJson: false,
    },
    {
      name: `inline config and relative paths`,
      inlineConfig: {
        target: 'solid',
        autoCodeSplitting: false,
        routesDirectory: 'src/paths',
        generatedRouteTree: 'src/tree/routeTree.gen.ts',
        enableRouteGeneration: true,
      } as Partial<Config>,
      withJson: false,
    },
    {
      name: `inline config and "./" form relative paths`,
      inlineConfig: {
        target: 'solid',
        autoCodeSplitting: true,
        routesDirectory: './src/paths',
        generatedRouteTree: './src/tree/routeTree.gen.ts',
        enableRouteGeneration: true,
      } as Partial<Config>,
      withJson: false,
    },
    {
      name: 'inline config and absolute paths',
      inlineConfig: {
        target: 'solid',
        autoCodeSplitting: false,
        routesDirectory: '/src/paths',
        generatedRouteTree: '/src/tree/routeTree.gen.ts',
        enableRouteGeneration: true,
      } as Partial<Config>,
      withJson: false,
    },
    {
      name: 'json config',
      inlineConfig: {} as Partial<Config>,
      withJson: true,
    },
    {
      name: 'combination of json and inline config',
      inlineConfig: {
        target: 'react',
        autoCodeSplitting: true,
        routesDirectory: './src/paths',
        generatedRouteTree: './src/tree/routeTree.gen.ts',
        enableRouteGeneration: true,
      } as Partial<Config>,
      withJson: true,
    },
  ]

  it.each(testCases)('must resolve $name', ({ inlineConfig, withJson }) => {
    const rootPath = withJson ? 'withJson' : 'withoutJson'
    const root = path.resolve(import.meta.dirname, 'config', rootPath)

    const jsonConfig = withJson
      ? JSON.parse(readFileSync(path.resolve(root, 'tsr.config.json'), 'utf-8'))
      : undefined

    const routesPath =
      inlineConfig.routesDirectory ??
      jsonConfig?.routesDirectory ??
      'src/routes'

    const routeTreePath =
      inlineConfig.generatedRouteTree ??
      jsonConfig?.generatedRouteTree ??
      'src/routeTree.gen.ts'

    const routesDirectory = path.resolve(
      import.meta.dirname,
      'config',
      rootPath,
      routesPath,
    )

    const generatedRouteTree = path.resolve(
      import.meta.dirname,
      'config',
      rootPath,
      routeTreePath,
    )

    const resolvedConfig = getConfig(inlineConfig, root)

    expect(resolvedConfig).toEqual(
      expect.objectContaining({
        ...jsonConfig,
        ...inlineConfig,
        routesDirectory,
        generatedRouteTree,
      }),
    )
  })
})
