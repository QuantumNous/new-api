import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path, { dirname, join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  index,
  layout,
  physical,
  rootRoute,
  route,
} from '@tanstack/virtual-file-routes'
import { Generator, getConfig, virtualGetRouteNodes } from '../src'
import type { Config } from '../src'

function makeFolderDir(folder: string) {
  return join(process.cwd(), 'tests', 'generator', folder)
}

async function readDir(...paths: Array<string>) {
  const folders = await fs.readdir(
    join(process.cwd(), 'tests', 'generator', ...paths),
  )
  return folders
}

async function traverseDirectory(
  dir: string,
  handleFile: (filePath: string) => void | Promise<void>,
) {
  const files = await fs.readdir(dir, { withFileTypes: true })

  for (const file of files) {
    const filePath = join(dir, file.name)

    if (file.isDirectory()) {
      await traverseDirectory(filePath, handleFile)
    } else {
      await handleFile(filePath)
    }
  }
}

function setupConfig(
  folder: string,
  inlineConfig: Partial<Omit<Config, 'routesDirectory'>> = {},
) {
  const { generatedRouteTree = `/routeTree.gen.ts`, ...rest } = inlineConfig
  const dir = makeFolderDir(folder)

  const configFilePath = join(dir, 'tsr.config.json')
  const configDirectory = existsSync(configFilePath) ? dir : undefined

  const config = getConfig(
    {
      disableLogging: true,
      routesDirectory: dir + '/routes',
      generatedRouteTree: dir + generatedRouteTree,
      ...rest,
    },
    configDirectory,
  )
  return config
}

async function getRouteTreeFileText(config: Config) {
  const location = config.generatedRouteTree
  const text = await fs.readFile(location, 'utf-8')
  return text
}

function rewriteConfigByFolderName(folderName: string, config: Config) {
  switch (folderName) {
    case 'append-and-prepend':
      config.routeTreeFileHeader = ['// prepend1', '// prepend2']
      config.routeTreeFileFooter = ['// append1', '// append2']
      break
    case 'no-formatted-route-tree':
      config.enableRouteTreeFormatting = false
      break
    case 'custom-tokens':
      config.indexToken = '_1nd3x'
      config.routeToken = '_r0ut3_'
      break
    case 'escaped-custom-tokens':
      config.indexToken = '_1nd3x'
      config.routeToken = '_r0ut3_'
      break
    case 'virtual':
      {
        const virtualRouteConfig = rootRoute('root.tsx', [
          index('index.tsx'),
          route('$lang', [index('pages.tsx')]),
          layout('layout.tsx', [
            route('/dashboard', 'db/dashboard.tsx', [
              index('db/dashboard-index.tsx'),
              route('/invoices', 'db/dashboard-invoices.tsx', [
                index('db/invoices-index.tsx'),
                route('$id', 'db/invoice-detail.tsx'),
              ]),
            ]),
            physical('/hello', 'subtree'),
          ]),
        ])
        config.virtualRouteConfig = virtualRouteConfig
      }
      break
    case 'virtual-with-escaped-underscore':
      {
        // Test case for escaped underscores in physical routes mounted via virtual config
        // This ensures originalRoutePath is correctly prefixed when paths are updated
        const virtualRouteConfig = rootRoute('__root.tsx', [
          index('index.tsx'),
          physical('/api', 'physical-routes'),
        ])
        config.virtualRouteConfig = virtualRouteConfig
      }
      break
    case 'types-disabled':
      config.disableTypes = true
      config.generatedRouteTree =
        makeFolderDir(folderName) + `/routeTree.gen.js`
      break
    case 'custom-scaffolding':
      config.customScaffolding = {
        routeTemplate: [
          'import * as React from "react";\n',
          '%%tsrImports%%\n\n',
          '%%tsrExportStart%%{\n component: RouteComponent\n }%%tsrExportEnd%%\n\n',
          'function RouteComponent() { return "Hello %%tsrPath%%!" };\n',
        ].join(''),
        lazyRouteTemplate: [
          'import React, { useState } from "react";\n',
          '%%tsrImports%%\n\n',
          '%%tsrExportStart%%{\n component: RouteComponent\n }%%tsrExportEnd%%\n\n',
          'function RouteComponent() { return "Hello %%tsrPath%%!" };\n',
        ].join(''),
      }
      break
    case 'routeFileIgnore':
      config.routeFileIgnorePattern = 'ignoredPattern'
      config.routeFileIgnorePrefix = 'imIgnored'
      break
    case 'routeFilePrefix':
      config.routeFileIgnorePattern = 'ignoredPattern'
      config.routeFilePrefix = 'r&'
      break
    case 'regex-tokens-inline':
      // Test inline config with RegExp tokens
      // indexToken matches patterns like "index-page", "home-page"
      // routeToken matches patterns like "main-layout", "protected-layout"
      config.indexToken = /[a-z]+-page/
      config.routeToken = /[a-z]+-layout/
      break
    case 'virtual-sibling-routes':
      {
        // Test case for issue #5822: Virtual routes should respect explicit sibling relationships
        // Routes /posts and /posts/$id should remain siblings under the layout,
        // NOT auto-nested based on path matching
        const virtualRouteConfig = rootRoute('__root.tsx', [
          layout('_main', 'layout.tsx', [
            route('/posts', 'posts.tsx'),
            route('/posts/$id', 'post-detail.tsx'),
          ]),
        ])
        config.virtualRouteConfig = virtualRouteConfig
      }
      break
    case 'virtual-root-sibling-routes':
      {
        // Test case for issue #5431: Virtual routes that are siblings at the root level
        // should NOT be auto-nested based on shared path prefix.
        // /device/$id and /device/$id/history/$filename are both children of root,
        // NOT parent-child of each other.
        const virtualRouteConfig = rootRoute('__root.tsx', [
          route('/device/$id', 'device/route.tsx'),
          route('/device/$id/history/$filename', 'history/route.tsx'),
        ])
        config.virtualRouteConfig = virtualRouteConfig
      }
      break
    case 'add-extensions-custom':
      config.addExtensions = '.js'
      break
    case 'virtual-nested-layouts-with-virtual-route':
      {
        // Test case for nested layouts with a virtual file-less route in between.
        const virtualRouteConfig = rootRoute('__root.tsx', [
          index('home.tsx'),
          layout('first', 'layout/first-layout.tsx', [
            layout('layout/second-layout.tsx', [
              route('route-without-file', [
                route('/layout-a', 'a.tsx'),
                route('/layout-b', 'b.tsx'),
              ]),
            ]),
          ]),
        ])
        config.virtualRouteConfig = virtualRouteConfig
      }
      break
    default:
      break
  }
}

async function preprocess(folderName: string) {
  if (folderName.startsWith('file-modification')) {
    const templateVerbosePath = join(
      makeFolderDir(folderName),
      'template-verbose.tsx',
    )
    const templatePath = join(makeFolderDir(folderName), 'template.tsx')
    const lazyTemplatePath = join(
      makeFolderDir(folderName),
      'template.lazy.tsx',
    )

    const makeRoutePath = (file: string) =>
      join(makeFolderDir(folderName), 'routes', '(test)', file)
    const makeEmptyFile = async (file: string) => {
      const fh = await fs.open(makeRoutePath(file), 'w')
      await fh.close()
    }

    await fs.copyFile(templateVerbosePath, makeRoutePath('foo.bar.tsx'))
    await fs.copyFile(templatePath, makeRoutePath('foo.tsx'))
    await fs.copyFile(lazyTemplatePath, makeRoutePath('initiallyLazy.tsx'))
    await fs.copyFile(templatePath, makeRoutePath('bar.lazy.tsx'))
    await fs.copyFile(templatePath, makeRoutePath('double-quotes.tsx'))
    await fs.copyFile(templatePath, makeRoutePath('template-literal.tsx'))
    await fs.copyFile(templatePath, makeRoutePath('duplicate-import.tsx'))
    await makeEmptyFile('initiallyEmpty.tsx')
    await makeEmptyFile('initiallyEmpty.lazy.tsx')

    await fs.writeFile(
      makeRoutePath('double-quotes.tsx'),
      (await fs.readFile(makeRoutePath('double-quotes.tsx'), 'utf-8')).replace(
        "createFileRoute('/foo/bar')",
        'createFileRoute("/foo/bar")',
      ),
    )

    await fs.writeFile(
      makeRoutePath('template-literal.tsx'),
      (
        await fs.readFile(makeRoutePath('template-literal.tsx'), 'utf-8')
      ).replace("createFileRoute('/foo/bar')", 'createFileRoute(`/foo/bar`)'),
    )

    await fs.writeFile(
      makeRoutePath('duplicate-import.tsx'),
      [
        "import { createFileRoute } from '@tanstack/react-router'",
        "import * as React from 'react'",
        "import { Link, Outlet } from '@tanstack/react-router'",
        '',
        "export const Route = createFileRoute('/foo/bar')({",
        '  component: PostsLayoutComponent,',
        '})',
        '',
        'function PostsLayoutComponent() {',
        '  return (',
        '    <>',
        '      <Link to="/">Home</Link>',
        '      <Outlet />',
        '    </>',
        '  )',
        '}',
        '',
      ].join('\n'),
    )
  } else if (folderName === 'custom-scaffolding') {
    const makeEmptyFile = async (...file: Array<string>) => {
      const filePath = join(makeFolderDir(folderName), 'routes', ...file)
      const dir = dirname(filePath)
      await fs.mkdir(dir, { recursive: true })
      const fh = await fs.open(filePath, 'w')
      await fh.close()
    }

    await makeEmptyFile('__root.tsx')
    await makeEmptyFile('index.tsx')
    await makeEmptyFile('foo.lazy.tsx')
    await makeEmptyFile('api', 'bar.tsx')
  }
}

async function postprocess(folderName: string) {
  switch (folderName) {
    case 'file-modification': {
      const routeFiles = await readDir(folderName, 'routes', '(test)')
      await Promise.all(
        routeFiles
          .filter((r) => r.endsWith('.tsx'))
          .map(async (routeFile) => {
            const text = await fs.readFile(
              join(makeFolderDir(folderName), 'routes', '(test)', routeFile),
              'utf-8',
            )
            await expect(text).toMatchFileSnapshot(
              join('generator', folderName, 'snapshots', routeFile),
            )
          }),
      )
      break
    }
    case 'custom-scaffolding': {
      const startDir = join(makeFolderDir(folderName), 'routes')
      await traverseDirectory(startDir, async (filePath) => {
        const relativePath = relative(startDir, filePath)
        if (filePath.endsWith('.tsx')) {
          await expect(
            await fs.readFile(filePath, 'utf-8'),
          ).toMatchFileSnapshot(
            join('generator', folderName, 'snapshots', relativePath),
          )
        }
      })
    }
  }
}

function shouldThrow(folderName: string) {
  if (folderName === 'duplicate-fullPath') {
    return `Conflicting configuration paths were found for the following routes: "/", "/".`
  }
  if (folderName === 'virtual-physical-empty-path-conflict-root') {
    return 'Invalid route path "" was found.'
  }
  if (folderName === 'virtual-physical-empty-path-conflict-virtual') {
    return `Conflicting configuration paths were found for the following routes: "/about", "/about".`
  }
  return undefined
}

describe('generator works', async () => {
  const folderNames = await readDir()

  it.each(folderNames)(
    'should wire-up the routes for a "%s" tree',
    async (folderName) => {
      const folderRoot = makeFolderDir(folderName)

      const config = await setupConfig(folderName)

      rewriteConfigByFolderName(folderName, config)

      await preprocess(folderName)
      const generator = new Generator({ config, root: folderRoot })
      const error = shouldThrow(folderName)
      if (error) {
        try {
          await generator.run()
        } catch (e) {
          expect(e).toBeInstanceOf(Error)
          expect((e as Error).message.startsWith(error)).toBeTruthy()
        }
      } else {
        await generator.run()

        const generatedRouteTree = await getRouteTreeFileText(config)

        const snapshotPath = `routeTree.snapshot.${config.disableTypes ? 'js' : 'ts'}`

        await expect(generatedRouteTree).toMatchFileSnapshot(
          join('generator', folderName, snapshotPath),
        )
      }

      await postprocess(folderName)
    },
  )

  it('physical() mount returns absolute physicalDirectories', async () => {
    const folderName = 'virtual-physical-no-prefix'
    const dir = makeFolderDir(folderName)
    const config = await setupConfig(folderName)

    const { physicalDirectories } = await virtualGetRouteNodes(config, dir, {
      indexTokenSegmentRegex: /^(?:index)$/,
      routeTokenSegmentRegex: /^(?:route)$/,
    })

    expect(physicalDirectories.length).toBeGreaterThan(0)
    physicalDirectories.forEach((physicalDir) => {
      expect(path.isAbsolute(physicalDir)).toBe(true)
    })
  })

  it.each(folderNames)(
    'should create directory for routeTree if it does not exist',
    async () => {
      const folderName = 'only-root'
      const folderRoot = makeFolderDir(folderName)
      let pathCreated = false

      const config = await setupConfig(folderName)

      rewriteConfigByFolderName(folderName, config)

      await preprocess(folderName)
      config.generatedRouteTree = join(
        folderRoot,
        'generated',
        `/routeTree.gen.ts`,
      )
      const generator = new Generator({ config, root: folderRoot })

      const error = shouldThrow(folderName)
      if (error) {
        try {
          await generator.run()
        } catch (e) {
          expect(e).toBeInstanceOf(Error)
          expect((e as Error).message.startsWith(error)).toBeTruthy()
        }
      } else {
        await generator.run()

        const generatedRouteTree = await getRouteTreeFileText(config)

        await expect(generatedRouteTree).toMatchFileSnapshot(
          join(
            'generator',
            folderName,
            `routeTree.generated.snapshot.${config.disableTypes ? 'js' : 'ts'}`,
          ),
        )

        pathCreated = await fs.access(dirname(config.generatedRouteTree)).then(
          () => true,
          () => false,
        )

        await expect(pathCreated).toBe(true)
      }

      await postprocess(folderName)

      if (pathCreated) {
        await fs.rm(dirname(config.generatedRouteTree), { recursive: true })
      }
    },
  )
})
