import { describe, expect, test } from 'vitest'
import { deserialize } from 'seroval'
import { shouldRebaseInlineCssUrls } from '../../src/start-manifest-plugin/inlineCss'
import {
  appendUniqueStrings,
  buildStartManifest,
  createChunkCssAssetCollector,
  createManifestAssetResolvers,
  serializeStartManifest,
  scanClientChunks,
  type StartManifest,
} from '../../src/start-manifest-plugin/manifestBuilder'
import type { ManifestCssLink } from '@tanstack/router-core'
import type { Rollup } from 'vite'
import {
  getRouteFilePathsFromModuleIds,
  normalizeViteClientBuild,
  normalizeViteClientChunk,
} from '../../src/vite/start-manifest-plugin/normalized-client-build'

function normalizeTestBuild(bundle: Rollup.OutputBundle) {
  return normalizeViteClientBuild(bundle)
}

function normalizeTestChunk(chunk: Rollup.OutputChunk) {
  return normalizeViteClientChunk(chunk)
}

function deserializeSerializedManifest(serialized: string): StartManifest {
  return deserialize(serialized) as StartManifest
}

function makeChunk(options: {
  fileName: string
  imports?: Array<string>
  dynamicImports?: Array<string>
  importedCss?: Array<string>
  moduleIds?: Array<string>
  isEntry?: boolean
}): Rollup.OutputChunk {
  return {
    type: 'chunk',
    fileName: options.fileName,
    name: options.fileName,
    imports: options.imports ?? [],
    dynamicImports: options.dynamicImports ?? [],
    moduleIds: options.moduleIds ?? [],
    isEntry: options.isEntry ?? false,
    isDynamicEntry: false,
    facadeModuleId: null,
    implicitlyLoadedBefore: [],
    importedBindings: {},
    modules: {},
    referencedFiles: [],
    code: '',
    map: null,
    exports: [],
    preliminarilyFileName: options.fileName,
    viteMetadata: {
      importedCss: new Set(options.importedCss ?? []),
      importedAssets: new Set(),
    },
  } as unknown as Rollup.OutputChunk
}

function makeCssAsset(fileName: string, source: string): Rollup.OutputAsset {
  return {
    type: 'asset',
    fileName,
    name: fileName,
    names: [fileName],
    source,
    needsCodeReference: false,
    originalFileNames: [],
  } as unknown as Rollup.OutputAsset
}

function makeStylesheetLink(href: string): ManifestCssLink {
  return href
}

function getManifestCssHref(link: ManifestCssLink) {
  return typeof link === 'string' ? link : link.href
}

describe('getRouteFilePathsFromModuleIds', () => {
  test('returns unique route file paths only for tsr split modules', () => {
    expect(
      getRouteFilePathsFromModuleIds([
        '/routes/posts.tsx?tsr-split=component',
        '/routes/posts.tsx?tsr-split=loader',
        '/routes/index.tsx?foo=bar',
        '/routes/users.tsx?foo=bar&tsr-split=component',
      ]),
    ).toEqual(['/routes/posts.tsx', '/routes/users.tsx'])
  })

  test('returns empty array for empty input', () => {
    expect(getRouteFilePathsFromModuleIds([])).toEqual([])
  })

  test('returns empty array when no module has query string', () => {
    expect(
      getRouteFilePathsFromModuleIds([
        '/routes/posts.tsx',
        '/routes/index.tsx',
      ]),
    ).toEqual([])
  })

  test('returns empty array when no module has tsr-split param', () => {
    expect(
      getRouteFilePathsFromModuleIds([
        '/routes/posts.tsx?foo=bar',
        '/routes/index.tsx?baz=qux',
      ]),
    ).toEqual([])
  })
})

describe('appendUniqueStrings', () => {
  test('preserves order while appending only new values', () => {
    expect(appendUniqueStrings(['a', 'b'], ['b', 'c', 'a', 'd'])).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
  })

  test('returns original target array when nothing new is appended', () => {
    const target = ['a', 'b']

    expect(appendUniqueStrings(target, ['b', 'a'])).toBe(target)
  })

  test('returns source array when target is empty', () => {
    const source = ['a', 'b']

    expect(appendUniqueStrings(undefined, source)).toBe(source)
  })
})

describe('scanClientChunks', () => {
  test('collects entry chunk and route chunk mappings', () => {
    const entryChunk = makeChunk({ fileName: 'entry.js', isEntry: true })
    const routeChunk = makeChunk({
      fileName: 'posts.js',
      moduleIds: ['/routes/posts.tsx?tsr-split=component'],
    })

    const normalizedBuild = normalizeTestBuild({
      'entry.js': entryChunk,
      'posts.js': routeChunk,
    })
    const scanned = scanClientChunks(normalizedBuild)

    expect(scanned.entryChunk).toBe(
      normalizedBuild.chunksByFileName.get('entry.js'),
    )
    expect(scanned.routeChunksByFilePath.get('/routes/posts.tsx')).toEqual([
      normalizedBuild.chunksByFileName.get('posts.js')!,
    ])
  })

  test('detects Hydrate metadata from chunk module ids', () => {
    const chunk = normalizeTestChunk(
      makeChunk({
        fileName: 'widget.js',
        moduleIds: ['/routes/posts.tsx?tss-hydrate=posts_widget'],
      }),
    )

    expect(chunk.hydrationIds).toEqual(['posts_widget'])
  })

  test('throws when no entry chunk exists', () => {
    const routeChunk = makeChunk({
      fileName: 'posts.js',
      moduleIds: ['/routes/posts.tsx?tsr-split=component'],
    })

    expect(() =>
      scanClientChunks(normalizeTestBuild({ 'posts.js': routeChunk })),
    ).toThrow('No entry file found')
  })
})

describe('createManifestAssetResolvers + createChunkCssAssetCollector', () => {
  test('reuses cached stylesheet links', () => {
    const entryChunk = makeChunk({
      fileName: 'entry.js',
      imports: ['shared.js'],
      importedCss: ['entry.css'],
    })
    const sharedChunk = makeChunk({
      fileName: 'shared.js',
      importedCss: ['shared.css'],
    })
    const chunksByFileName = new Map([
      ['entry.js', normalizeTestChunk(entryChunk)],
      ['shared.js', normalizeTestChunk(sharedChunk)],
    ])

    const linkResolvers = createManifestAssetResolvers('/assets')
    const cssLinkCollector = createChunkCssAssetCollector({
      chunksByFileName,
      getStylesheetLink: linkResolvers.getStylesheetLink,
    })

    const links = cssLinkCollector.getChunkCssAssets(
      chunksByFileName.get('entry.js')!,
    )

    expect(links).toEqual(['/assets/shared.css', '/assets/entry.css'])

    expect(linkResolvers.getStylesheetLink('shared.css')).toBe(
      linkResolvers.getStylesheetLink('shared.css'),
    )
  })
})

describe('createChunkCssAssetCollector', () => {
  test('dedupes css from shared imported chunks', () => {
    const chunkA = makeChunk({
      fileName: 'a.js',
      imports: ['b.js', 'c.js'],
      importedCss: ['a.css'],
    })
    const chunkB = makeChunk({
      fileName: 'b.js',
      imports: ['shared.js'],
      importedCss: ['b.css'],
    })
    const chunkC = makeChunk({
      fileName: 'c.js',
      imports: ['shared.js'],
      importedCss: ['c.css'],
    })
    const sharedChunk = makeChunk({
      fileName: 'shared.js',
      importedCss: ['shared.css'],
    })
    const chunksByFileName = new Map([
      ['a.js', normalizeTestChunk(chunkA)],
      ['b.js', normalizeTestChunk(chunkB)],
      ['c.js', normalizeTestChunk(chunkC)],
      ['shared.js', normalizeTestChunk(sharedChunk)],
    ])

    const { getChunkCssAssets } = createChunkCssAssetCollector({
      chunksByFileName,
      getStylesheetLink: (cssFile) => ({
        href: `/${cssFile}`,
      }),
    })

    const links = getChunkCssAssets(chunksByFileName.get('a.js')!)

    expect(links.map(getManifestCssHref)).toEqual([
      '/shared.css',
      '/b.css',
      '/c.css',
      '/a.css',
    ])
  })

  test('handles circular chunk imports without infinite recursion', () => {
    const chunkA = makeChunk({
      fileName: 'a.js',
      imports: ['b.js'],
      importedCss: ['a.css'],
    })
    const chunkB = makeChunk({
      fileName: 'b.js',
      imports: ['a.js'],
      importedCss: ['b.css'],
    })
    const chunksByFileName = new Map([
      ['a.js', normalizeTestChunk(chunkA)],
      ['b.js', normalizeTestChunk(chunkB)],
    ])

    const { getChunkCssAssets } = createChunkCssAssetCollector({
      chunksByFileName,
      getStylesheetLink: (cssFile) => ({
        href: `/${cssFile}`,
      }),
    })

    const links = getChunkCssAssets(chunksByFileName.get('a.js')!)
    const hrefs = links.map(getManifestCssHref)

    expect(hrefs).toContain('/a.css')
    expect(hrefs).toContain('/b.css')
    // No infinite recursion — test completes
  })
})

describe('buildStartManifest', () => {
  test('skips inline CSS transforms when no relative URLs need rebasing', () => {
    expect(shouldRebaseInlineCssUrls('.root {\n  color: red;\n}')).toBe(false)
    expect(shouldRebaseInlineCssUrls('.root{background:url(/dot.svg)}')).toBe(
      false,
    )
    expect(
      shouldRebaseInlineCssUrls(
        '.root{background:url(data:image/svg+xml,foo)}',
      ),
    ).toBe(false)
    expect(shouldRebaseInlineCssUrls('.card{background:url(./dot.svg)}')).toBe(
      true,
    )
    expect(shouldRebaseInlineCssUrls('@import "../theme.css";')).toBe(true)
  })

  test('embeds rebased inline CSS content when enabled', () => {
    const entryChunk = makeChunk({
      fileName: 'entry.js',
      isEntry: true,
      importedCss: ['root.css'],
    })
    const routeChunk = makeChunk({
      fileName: 'dashboard.js',
      importedCss: ['dashboard.css'],
      moduleIds: ['/routes/dashboard.tsx?tsr-split=component'],
    })

    const manifest = buildStartManifest({
      clientBuild: normalizeTestBuild({
        'entry.js': entryChunk,
        'dashboard.js': routeChunk,
        'root.css': makeCssAsset('root.css', '.root{color:red}'),
        'dashboard.css': makeCssAsset(
          'dashboard.css',
          '.card{background:url("./dot.svg")}',
        ),
      }),
      routeTreeRoutes: {
        __root__: {},
        '/dashboard': { filePath: '/routes/dashboard.tsx' },
      },
      basePath: '/assets',
      inlineCss: { enabled: true, transformAssets: false },
    })

    expect(manifest.inlineCss?.styles['/assets/root.css']).toBe(
      '.root{color:red}',
    )
    expect(manifest.inlineCss?.styles['/assets/dashboard.css']).toBe(
      '.card{background:url(/assets/dot.svg)}',
    )
  })

  test('emits inline CSS URL templates when transformAssets is enabled', () => {
    const entryChunk = makeChunk({
      fileName: 'entry.js',
      isEntry: true,
      importedCss: ['root.css'],
    })

    const manifest = buildStartManifest({
      clientBuild: normalizeTestBuild({
        'entry.js': entryChunk,
        'root.css': makeCssAsset(
          'root.css',
          '@import "./theme.css" screen;.card{background:url("./dot.svg")} .skip{background:url(data:image/svg+xml,foo)}',
        ),
      }),
      routeTreeRoutes: {
        __root__: {},
      },
      basePath: '/assets',
      inlineCss: { enabled: true, transformAssets: true },
    })

    expect(manifest.inlineCss?.styles['/assets/root.css']).toBe(
      '@import "/assets/theme.css" screen;.card{background:url("/assets/dot.svg")}.skip{background:url(data:image/svg+xml,foo)}',
    )
    expect(manifest.inlineCss?.templates?.['/assets/root.css']).toEqual({
      strings: [
        '@import "',
        '" screen;.card{background:url("',
        '")}.skip{background:url(data:image/svg+xml,foo)}',
      ],
      urls: ['/assets/theme.css', '/assets/dot.svg'],
    })
  })

  test('throws when inline CSS content is missing for a stylesheet link', () => {
    const entryChunk = makeChunk({
      fileName: 'entry.js',
      isEntry: true,
      importedCss: ['root.css'],
    })

    expect(() =>
      buildStartManifest({
        clientBuild: normalizeTestBuild({
          'entry.js': entryChunk,
        }),
        routeTreeRoutes: {
          __root__: {},
        },
        basePath: '/assets',
        inlineCss: { enabled: true, transformAssets: false },
      }),
    ).toThrow('could not find CSS content')
  })

  test('allows callers to attach additional route stylesheet links', () => {
    const entryChunk = makeChunk({
      fileName: 'entry.js',
      isEntry: true,
      moduleIds: ['/src/entry.tsx'],
    })

    const linkResolvers = createManifestAssetResolvers('/assets')

    const manifest = buildStartManifest({
      clientBuild: normalizeViteClientBuild({
        'entry.js': entryChunk,
      }),
      routeTreeRoutes: {
        __root__: { children: ['/about'] } as any,
        '/about': { filePath: '/routes/about.tsx' },
      },
      basePath: '/assets',
      additionalRouteAssets: {
        __root__: [linkResolvers.getStylesheetLink('style.css')],
      },
    })

    expect(manifest.routes.__root__!.css).toEqual([
      makeStylesheetLink('/assets/style.css'),
    ])
  })

  test('dedupes duplicate additional route scripts on the same route', () => {
    const entryChunk = makeChunk({
      fileName: 'entry.js',
      isEntry: true,
      moduleIds: ['/src/entry.tsx'],
    })
    const script = {
      attrs: {
        src: '/assets/custom.js',
        type: 'module',
      },
    } as const

    const manifest = buildStartManifest({
      clientBuild: normalizeViteClientBuild({
        'entry.js': entryChunk,
      }),
      routeTreeRoutes: {
        __root__: { children: ['/about'] } as any,
        '/about': { filePath: '/routes/about.tsx' },
      },
      basePath: '/assets',
      additionalRouteAssets: {
        __root__: [script, script],
      },
    })

    expect(manifest.routes.__root__!.scripts).toEqual([
      script,
      {
        attrs: {
          type: 'module',
          async: true,
          src: '/assets/entry.js',
        },
      },
    ])
  })

  test('dedupes additional route scripts already owned by ancestor routes', () => {
    const entryChunk = makeChunk({
      fileName: 'entry.js',
      isEntry: true,
      moduleIds: ['/src/entry.tsx'],
    })
    const script = {
      attrs: {
        src: '/assets/custom.js',
        type: 'module',
      },
    } as const

    const manifest = buildStartManifest({
      clientBuild: normalizeViteClientBuild({
        'entry.js': entryChunk,
      }),
      routeTreeRoutes: {
        __root__: { children: ['/about'] } as any,
        '/about': { filePath: '/routes/about.tsx' },
      },
      basePath: '/assets',
      additionalRouteAssets: {
        __root__: [script],
        '/about': [script],
      },
    })

    expect(manifest.routes.__root__!.scripts).toEqual([
      script,
      {
        attrs: {
          type: 'module',
          async: true,
          src: '/assets/entry.js',
        },
      },
    ])
    expect(manifest.routes['/about']?.scripts).toBeUndefined()
  })

  test('rejects additional route entries for unknown route ids', () => {
    const entryChunk = makeChunk({
      fileName: 'entry.js',
      isEntry: true,
      moduleIds: ['/src/entry.tsx'],
    })

    const linkResolvers = createManifestAssetResolvers('/assets')

    expect(() =>
      buildStartManifest({
        clientBuild: normalizeViteClientBuild({
          'entry.js': entryChunk,
        }),
        routeTreeRoutes: {
          __root__: { children: ['/about'] } as any,
          '/about': { filePath: '/routes/about.tsx' },
        },
        basePath: '/assets',
        additionalRouteAssets: {
          '/missing': [linkResolvers.getStylesheetLink('style.css')],
        },
      }),
    ).toThrow(
      'expected additionalRouteAssets routeId to exist in routeTreeRoutes: /missing',
    )
  })

  test('dedupes route CSS gathered through overlapping chunk imports', () => {
    const entryChunk = makeChunk({
      fileName: 'entry.js',
      isEntry: true,
    })
    const routeChunk = makeChunk({
      fileName: 'route.js',
      imports: ['branch-a.js', 'branch-b.js'],
      moduleIds: ['/routes/about.tsx?tsr-split=component'],
    })
    const branchAChunk = makeChunk({
      fileName: 'branch-a.js',
      imports: ['shared.js'],
      importedCss: ['branch-a.css'],
    })
    const branchBChunk = makeChunk({
      fileName: 'branch-b.js',
      imports: ['shared.js'],
      importedCss: ['branch-b.css'],
    })
    const sharedChunk = makeChunk({
      fileName: 'shared.js',
      importedCss: ['shared.css'],
    })

    const manifest = buildStartManifest({
      clientBuild: normalizeViteClientBuild({
        'entry.js': entryChunk,
        'route.js': routeChunk,
        'branch-a.js': branchAChunk,
        'branch-b.js': branchBChunk,
        'shared.js': sharedChunk,
      }),
      routeTreeRoutes: {
        __root__: { children: ['/about'] } as any,
        '/about': { filePath: '/routes/about.tsx' },
      },
      basePath: '/assets',
    })

    expect(manifest.routes['/about']!.css).toEqual([
      makeStylesheetLink('/assets/shared.css'),
      makeStylesheetLink('/assets/branch-a.css'),
      makeStylesheetLink('/assets/branch-b.css'),
    ])
  })

  test('adds Hydrate chunk CSS without preloading deferred component JS by default', () => {
    const entryChunk = makeChunk({
      fileName: 'entry.js',
      isEntry: true,
    })
    const routeChunk = makeChunk({
      fileName: 'about.js',
      dynamicImports: ['about-widget.js'],
      moduleIds: ['/routes/about.tsx?tsr-split=component'],
    })
    const widgetChunk = makeChunk({
      fileName: 'about-widget.js',
      importedCss: ['about-widget.css'],
      moduleIds: ['/routes/about.tsx?tss-hydrate=about_widget'],
    })

    const manifest = buildStartManifest({
      clientBuild: normalizeViteClientBuild({
        'entry.js': entryChunk,
        'about.js': routeChunk,
        'about-widget.js': widgetChunk,
      }),
      routeTreeRoutes: {
        __root__: { children: ['/about'] } as any,
        '/about': { filePath: '/routes/about.tsx' },
      },
      basePath: '/assets',
    })

    expect(manifest.routes['/about']!.css).toEqual([
      makeStylesheetLink('/assets/about-widget.css'),
    ])
    expect(manifest.routes['/about']!.preloads).toEqual(['/assets/about.js'])
  })

  test('adds nested Hydrate chunk CSS without preloading deferred component JS by default', () => {
    const entryChunk = makeChunk({
      fileName: 'entry.js',
      isEntry: true,
    })
    const routeChunk = makeChunk({
      fileName: 'about.js',
      dynamicImports: ['parent-widget.js'],
      moduleIds: ['/routes/about.tsx?tsr-split=component'],
    })
    const parentWidgetChunk = makeChunk({
      fileName: 'parent-widget.js',
      dynamicImports: ['child-widget.js'],
      importedCss: ['parent-widget.css'],
      moduleIds: ['/routes/about.tsx?tss-hydrate=parent_widget'],
    })
    const childWidgetChunk = makeChunk({
      fileName: 'child-widget.js',
      importedCss: ['child-widget.css'],
      moduleIds: ['/routes/about.tsx?tss-hydrate=child_widget'],
    })

    const manifest = buildStartManifest({
      clientBuild: normalizeViteClientBuild({
        'entry.js': entryChunk,
        'about.js': routeChunk,
        'parent-widget.js': parentWidgetChunk,
        'child-widget.js': childWidgetChunk,
      }),
      routeTreeRoutes: {
        __root__: { children: ['/about'] } as any,
        '/about': { filePath: '/routes/about.tsx' },
      },
      basePath: '/assets',
    })

    expect(manifest.routes['/about']!.css).toEqual([
      makeStylesheetLink('/assets/parent-widget.css'),
      makeStylesheetLink('/assets/child-widget.css'),
    ])
    expect(manifest.routes['/about']!.preloads).toEqual(['/assets/about.js'])
  })

  test('adds shared component Hydrate CSS to every statically importing route', () => {
    const entryChunk = makeChunk({
      fileName: 'entry.js',
      isEntry: true,
    })
    const aboutRouteChunk = makeChunk({
      fileName: 'about.js',
      imports: ['shared-widget.js'],
      moduleIds: ['/routes/about.tsx?tsr-split=component'],
    })
    const postsRouteChunk = makeChunk({
      fileName: 'posts.js',
      imports: ['shared-widget.js'],
      moduleIds: ['/routes/posts.tsx?tsr-split=component'],
    })
    const sharedWidgetChunk = makeChunk({
      fileName: 'shared-widget.js',
      dynamicImports: ['shared-hydrate.js'],
    })
    const sharedHydrateChunk = makeChunk({
      fileName: 'shared-hydrate.js',
      importedCss: ['shared-hydrate.css'],
      moduleIds: ['/components/Shared.tsx?tss-hydrate=shared_widget'],
    })

    const manifest = buildStartManifest({
      clientBuild: normalizeViteClientBuild({
        'entry.js': entryChunk,
        'about.js': aboutRouteChunk,
        'posts.js': postsRouteChunk,
        'shared-widget.js': sharedWidgetChunk,
        'shared-hydrate.js': sharedHydrateChunk,
      }),
      routeTreeRoutes: {
        __root__: { children: ['/about', '/posts'] } as any,
        '/about': { filePath: '/routes/about.tsx' },
        '/posts': { filePath: '/routes/posts.tsx' },
      },
      basePath: '/assets',
    })

    const expectedLink = makeStylesheetLink('/assets/shared-hydrate.css')
    expect(manifest.routes['/about']!.css).toEqual([expectedLink])
    expect(manifest.routes['/posts']!.css).toEqual([expectedLink])
    expect(manifest.routes['/about']!.preloads).toEqual([
      '/assets/about.js',
      '/assets/shared-widget.js',
    ])
    expect(manifest.routes['/posts']!.preloads).toEqual([
      '/assets/posts.js',
      '/assets/shared-widget.js',
    ])
  })

  test('does not add unrelated Hydrate CSS from the global entry graph to root', () => {
    const entryChunk = makeChunk({
      fileName: 'entry.js',
      isEntry: true,
      imports: ['app-shell.js'],
    })
    const appShellChunk = makeChunk({
      fileName: 'app-shell.js',
      dynamicImports: ['about-widget.js'],
    })
    const aboutWidgetChunk = makeChunk({
      fileName: 'about-widget.js',
      importedCss: ['about-widget.css'],
      moduleIds: ['/routes/about.tsx?tss-hydrate=about_widget'],
    })

    const manifest = buildStartManifest({
      clientBuild: normalizeViteClientBuild({
        'entry.js': entryChunk,
        'app-shell.js': appShellChunk,
        'about-widget.js': aboutWidgetChunk,
      }),
      routeTreeRoutes: {
        __root__: { children: ['/about'] } as any,
        '/about': { filePath: '/routes/about.tsx' },
      },
      basePath: '/assets',
    })

    expect(manifest.routes.__root__!.css).toBeUndefined()
    expect(manifest.routes.__root__!.preloads).toEqual([
      '/assets/entry.js',
      '/assets/app-shell.js',
    ])
  })

  test('adds root-owned Hydrate CSS without walking unrelated entry graph hydration', () => {
    const entryChunk = makeChunk({
      fileName: 'entry.js',
      isEntry: true,
      imports: ['app-shell.js'],
    })
    const rootChunk = makeChunk({
      fileName: 'root.js',
      dynamicImports: ['root-widget.js'],
      moduleIds: ['/routes/__root.tsx?tsr-split=component'],
    })
    const rootWidgetChunk = makeChunk({
      fileName: 'root-widget.js',
      importedCss: ['root-widget.css'],
      moduleIds: ['/routes/__root.tsx?tss-hydrate=root_widget'],
    })
    const appShellChunk = makeChunk({
      fileName: 'app-shell.js',
      dynamicImports: ['about-widget.js'],
    })
    const aboutWidgetChunk = makeChunk({
      fileName: 'about-widget.js',
      importedCss: ['about-widget.css'],
      moduleIds: ['/routes/about.tsx?tss-hydrate=about_widget'],
    })

    const manifest = buildStartManifest({
      clientBuild: normalizeViteClientBuild({
        'entry.js': entryChunk,
        'root.js': rootChunk,
        'root-widget.js': rootWidgetChunk,
        'app-shell.js': appShellChunk,
        'about-widget.js': aboutWidgetChunk,
      }),
      routeTreeRoutes: {
        __root__: {
          filePath: '/routes/__root.tsx',
          children: ['/about'],
        } as any,
        '/about': { filePath: '/routes/about.tsx' },
      },
      basePath: '/assets',
    })

    expect(manifest.routes.__root__!.css).toEqual([
      makeStylesheetLink('/assets/root-widget.css'),
    ])
    expect(manifest.routes.__root__!.preloads).toEqual([
      '/assets/root.js',
      '/assets/entry.js',
      '/assets/app-shell.js',
    ])
  })

  test('orders imported chunk css before route chunk css', () => {
    const entryChunk = makeChunk({
      fileName: 'entry.js',
      isEntry: true,
    })
    const routeChunk = makeChunk({
      fileName: 'field-detail-panel.js',
      imports: ['tabs.js'],
      importedCss: ['field-detail-panel.css'],
      moduleIds: ['/routes/field-detail-panel.tsx?tsr-split=component'],
    })
    const tabsChunk = makeChunk({
      fileName: 'tabs.js',
      importedCss: ['tabs.css'],
    })

    const manifest = buildStartManifest({
      clientBuild: normalizeViteClientBuild({
        'entry.js': entryChunk,
        'field-detail-panel.js': routeChunk,
        'tabs.js': tabsChunk,
      }),
      routeTreeRoutes: {
        __root__: { children: ['/field-detail-panel'] } as any,
        '/field-detail-panel': {
          filePath: '/routes/field-detail-panel.tsx',
        },
      },
      basePath: '/assets',
    })

    expect(
      manifest.routes['/field-detail-panel']!.css!.map(getManifestCssHref),
    ).toEqual(['/assets/tabs.css', '/assets/field-detail-panel.css'])
  })

  test('dedupes route CSS already owned by ancestor routes', () => {
    const entryChunk = makeChunk({
      fileName: 'entry.js',
      isEntry: true,
      imports: ['shared.js'],
      dynamicImports: ['about.js'],
    })
    const sharedChunk = makeChunk({
      fileName: 'shared.js',
      importedCss: ['main.css'],
    })
    const aboutChunk = makeChunk({
      fileName: 'about.js',
      imports: ['shared.js'],
      importedCss: ['about.css'],
      moduleIds: ['/routes/about.tsx?tsr-split=component'],
    })

    const manifest = buildStartManifest({
      clientBuild: normalizeViteClientBuild({
        'entry.js': entryChunk,
        'shared.js': sharedChunk,
        'about.js': aboutChunk,
      }),
      routeTreeRoutes: {
        __root__: { children: ['/about'] } as any,
        '/about': { filePath: '/routes/about.tsx' },
      },
      basePath: '/assets',
    })

    expect(manifest.routes.__root__!.css).toEqual([
      makeStylesheetLink('/assets/main.css'),
    ])

    expect(manifest.routes['/about']!.css).toEqual([
      makeStylesheetLink('/assets/about.css'),
    ])
  })

  test('serializeStartManifest preserves shared link identity across routes', () => {
    const sharedLink = {
      href: '/assets/shared.css',
      crossOrigin: 'anonymous',
    } satisfies ManifestCssLink
    const manifest: StartManifest = {
      routes: {
        __root__: {
          children: ['/a', '/b', '/c'],
        },
        '/a': {
          css: [sharedLink],
          preloads: ['/assets/a.js'],
        },
        '/b': {
          css: [sharedLink],
          preloads: ['/assets/b.js'],
        },
        '/c': {
          css: [sharedLink],
          preloads: ['/assets/c.js'],
        },
      },
    }

    const evaluated = deserializeSerializedManifest(
      serializeStartManifest(manifest),
    )

    const aLink = evaluated.routes['/a']?.css?.[0]
    const bLink = evaluated.routes['/b']?.css?.[0]
    const cLink = evaluated.routes['/c']?.css?.[0]

    expect(aLink).toBeDefined()
    expect(aLink).toBe(bLink)
    expect(bLink).toBe(cLink)
  })

  test('serializeStartManifest preserves non-link fields unchanged', () => {
    const manifest: StartManifest = {
      routes: {
        __root__: {
          children: ['/posts'],
          preloads: ['/assets/root.js'],
        },
        '/posts': {
          filePath: '/routes/posts.tsx',
          children: ['/posts/$postId'],
          preloads: ['/assets/posts.js'],
          scripts: [
            {
              attrs: {
                src: '/assets/posts.js',
                type: 'module',
              },
              children: 'console.log("posts")',
            },
          ],
        },
      },
    }

    expect(
      deserializeSerializedManifest(serializeStartManifest(manifest)),
    ).toEqual(manifest)
  })

  test('serializeStartManifest handles manifests without route links', () => {
    const manifest: StartManifest = {
      routes: {
        __root__: {
          children: ['/posts'],
          preloads: ['/assets/root.js'],
        },
        '/posts': {
          filePath: '/routes/posts.tsx',
          preloads: ['/assets/posts.js'],
        },
      },
    }

    expect(
      deserializeSerializedManifest(serializeStartManifest(manifest)),
    ).toEqual(manifest)
  })

  test('buildStartManifest includes scriptFormat only for iife output', () => {
    const entryChunk = makeChunk({
      fileName: 'entry.js',
      isEntry: true,
    })
    const routeTreeRoutes = {
      __root__: {
        filePath: '/routes/__root.tsx',
      },
    }

    expect(
      buildStartManifest({
        clientBuild: normalizeTestBuild({ 'entry.js': entryChunk }),
        routeTreeRoutes,
        basePath: '/assets',
        scriptFormat: 'module',
      }).scriptFormat,
    ).toBeUndefined()

    expect(
      buildStartManifest({
        clientBuild: normalizeTestBuild({ 'entry.js': entryChunk }),
        routeTreeRoutes,
        basePath: '/assets',
        scriptFormat: 'iife',
      }).scriptFormat,
    ).toBe('iife')
  })

  test('buildStartManifest emits client entry assets as root route scripts', () => {
    const entryChunk = makeChunk({
      fileName: 'entry.js',
      isEntry: true,
      imports: ['runtime.js', 'vendor.js'],
    })
    const runtimeChunk = makeChunk({ fileName: 'runtime.js' })
    const vendorChunk = makeChunk({ fileName: 'vendor.js' })
    const routeTreeRoutes = {
      __root__: {
        filePath: '/routes/__root.tsx',
      },
    }

    const moduleManifest = buildStartManifest({
      clientBuild: normalizeTestBuild({
        'entry.js': entryChunk,
        'runtime.js': runtimeChunk,
        'vendor.js': vendorChunk,
      }),
      routeTreeRoutes,
      basePath: '/assets',
      scriptFormat: 'module',
    })

    expect(moduleManifest.routes.__root__?.scripts).toEqual([
      {
        attrs: {
          type: 'module',
          async: true,
          src: '/assets/entry.js',
        },
      },
    ])

    const iifeManifest = buildStartManifest({
      clientBuild: normalizeTestBuild({
        'entry.js': entryChunk,
        'runtime.js': runtimeChunk,
        'vendor.js': vendorChunk,
      }),
      routeTreeRoutes,
      basePath: '/assets',
      scriptFormat: 'iife',
    })

    expect(iifeManifest.routes.__root__?.preloads).toEqual([
      '/assets/entry.js',
      '/assets/runtime.js',
      '/assets/vendor.js',
    ])
    expect(iifeManifest.routes.__root__?.scripts).toEqual([
      { attrs: { async: true, src: '/assets/runtime.js' } },
      { attrs: { async: true, src: '/assets/vendor.js' } },
      { attrs: { async: true, src: '/assets/entry.js' } },
    ])
  })
})

describe('route tree dedupe in buildStartManifest', () => {
  test('dedupes stylesheet links and preloads only along the active ancestor path', () => {
    const entryChunk = makeChunk({
      fileName: 'entry.js',
      isEntry: true,
      imports: ['root-shared.js'],
      importedCss: ['root.css'],
    })
    const rootSharedChunk = makeChunk({
      fileName: 'root-shared.js',
      importedCss: ['shared.css'],
    })
    const parentChunk = makeChunk({
      fileName: 'parent.js',
      imports: ['root-shared.js', 'parent-only.js'],
      moduleIds: ['/routes/parent.tsx?tsr-split=component'],
    })
    const parentOnlyChunk = makeChunk({
      fileName: 'parent-only.js',
      importedCss: ['parent.css'],
    })
    const childChunk = makeChunk({
      fileName: 'child.js',
      imports: ['root-shared.js', 'parent-only.js', 'child-only.js'],
      moduleIds: ['/routes/child.tsx?tsr-split=component'],
    })
    const childOnlyChunk = makeChunk({
      fileName: 'child-only.js',
      importedCss: ['child.css'],
    })
    const siblingChunk = makeChunk({
      fileName: 'sibling.js',
      imports: ['root-shared.js', 'sibling-only.js'],
      moduleIds: ['/routes/sibling.tsx?tsr-split=component'],
    })
    const siblingOnlyChunk = makeChunk({
      fileName: 'sibling-only.js',
      importedCss: ['sibling.css'],
    })

    const manifest = buildStartManifest({
      clientBuild: normalizeViteClientBuild({
        'entry.js': entryChunk,
        'root-shared.js': rootSharedChunk,
        'parent.js': parentChunk,
        'parent-only.js': parentOnlyChunk,
        'child.js': childChunk,
        'child-only.js': childOnlyChunk,
        'sibling.js': siblingChunk,
        'sibling-only.js': siblingOnlyChunk,
      }),
      routeTreeRoutes: {
        __root__: { children: ['/parent', '/sibling'] } as any,
        '/parent': { filePath: '/routes/parent.tsx', children: ['/child'] },
        '/child': { filePath: '/routes/child.tsx' },
        '/sibling': { filePath: '/routes/sibling.tsx' },
      },
      basePath: '/assets',
    })

    expect(manifest.routes.__root__!.css).toEqual([
      makeStylesheetLink('/assets/shared.css'),
      makeStylesheetLink('/assets/root.css'),
    ])
    expect(manifest.routes.__root__!.preloads).toEqual([
      '/assets/entry.js',
      '/assets/root-shared.js',
    ])
    expect(manifest.routes['/parent']!.css).toEqual([
      makeStylesheetLink('/assets/parent.css'),
    ])
    expect(manifest.routes['/parent']!.preloads).toEqual([
      '/assets/parent.js',
      '/assets/parent-only.js',
    ])
    expect(manifest.routes['/child']!.css).toEqual([
      makeStylesheetLink('/assets/child.css'),
    ])
    expect(manifest.routes['/child']!.preloads).toEqual([
      '/assets/child.js',
      '/assets/child-only.js',
    ])
    expect(manifest.routes['/sibling']!.css).toEqual([
      makeStylesheetLink('/assets/sibling.css'),
    ])
    expect(manifest.routes['/sibling']!.preloads).toEqual([
      '/assets/sibling.js',
      '/assets/sibling-only.js',
    ])
  })

  test('backtracking preserves reused assets and preloads for cousin routes', () => {
    const entryChunk = makeChunk({
      fileName: 'entry.js',
      isEntry: true,
    })
    const deepChunk = makeChunk({
      fileName: 'deep.js',
      importedCss: ['deep.css'],
    })
    const aChunk = makeChunk({
      fileName: 'a.js',
      moduleIds: ['/routes/a.tsx?tsr-split=component'],
    })
    const aChildChunk = makeChunk({
      fileName: 'a-child.js',
      imports: ['deep.js'],
      moduleIds: ['/routes/a-child.tsx?tsr-split=component'],
    })
    const bChunk = makeChunk({
      fileName: 'b.js',
      moduleIds: ['/routes/b.tsx?tsr-split=component'],
    })
    const bChildChunk = makeChunk({
      fileName: 'b-child.js',
      imports: ['deep.js', 'b-child-only.js'],
      moduleIds: ['/routes/b-child.tsx?tsr-split=component'],
    })
    const bChildOnlyChunk = makeChunk({
      fileName: 'b-child-only.js',
      importedCss: ['b-child.css'],
    })

    const manifest = buildStartManifest({
      clientBuild: normalizeViteClientBuild({
        'entry.js': entryChunk,
        'deep.js': deepChunk,
        'a.js': aChunk,
        'a-child.js': aChildChunk,
        'b.js': bChunk,
        'b-child.js': bChildChunk,
        'b-child-only.js': bChildOnlyChunk,
      }),
      routeTreeRoutes: {
        __root__: { children: ['/a', '/b'] } as any,
        '/a': { filePath: '/routes/a.tsx', children: ['/a-child'] },
        '/a-child': { filePath: '/routes/a-child.tsx' },
        '/b': { filePath: '/routes/b.tsx', children: ['/b-child'] },
        '/b-child': { filePath: '/routes/b-child.tsx' },
      },
      basePath: '/assets',
    })

    expect(manifest.routes['/a-child']!.css).toEqual([
      makeStylesheetLink('/assets/deep.css'),
    ])
    expect(manifest.routes['/a-child']!.preloads).toEqual([
      '/assets/a-child.js',
      '/assets/deep.js',
    ])
    expect(manifest.routes['/b-child']!.css).toEqual([
      makeStylesheetLink('/assets/deep.css'),
      makeStylesheetLink('/assets/b-child.css'),
    ])
    expect(manifest.routes['/b-child']!.preloads).toEqual([
      '/assets/b-child.js',
      '/assets/deep.js',
      '/assets/b-child-only.js',
    ])
  })

  test('dedupes reused assets and preloads across a deeply nested ancestor chain', () => {
    const entryChunk = makeChunk({
      fileName: 'entry.js',
      isEntry: true,
      imports: ['shared-root.js'],
      importedCss: ['root.css'],
    })
    const sharedRootChunk = makeChunk({
      fileName: 'shared-root.js',
      importedCss: ['shared-root.css'],
    })
    const levelOneChunk = makeChunk({
      fileName: 'level-one.js',
      imports: ['shared-root.js', 'level-one-only.js'],
      moduleIds: ['/routes/level-one.tsx?tsr-split=component'],
    })
    const levelOneOnlyChunk = makeChunk({
      fileName: 'level-one-only.js',
      importedCss: ['level-one.css'],
    })
    const levelTwoChunk = makeChunk({
      fileName: 'level-two.js',
      imports: ['shared-root.js', 'level-one-only.js', 'level-two-only.js'],
      moduleIds: ['/routes/level-two.tsx?tsr-split=component'],
    })
    const levelTwoOnlyChunk = makeChunk({
      fileName: 'level-two-only.js',
      importedCss: ['level-two.css'],
    })
    const levelThreeChunk = makeChunk({
      fileName: 'level-three.js',
      imports: [
        'shared-root.js',
        'level-one-only.js',
        'level-two-only.js',
        'level-three-only.js',
      ],
      moduleIds: ['/routes/level-three.tsx?tsr-split=component'],
    })
    const levelThreeOnlyChunk = makeChunk({
      fileName: 'level-three-only.js',
      importedCss: ['level-three.css'],
    })

    const manifest = buildStartManifest({
      clientBuild: normalizeViteClientBuild({
        'entry.js': entryChunk,
        'shared-root.js': sharedRootChunk,
        'level-one.js': levelOneChunk,
        'level-one-only.js': levelOneOnlyChunk,
        'level-two.js': levelTwoChunk,
        'level-two-only.js': levelTwoOnlyChunk,
        'level-three.js': levelThreeChunk,
        'level-three-only.js': levelThreeOnlyChunk,
      }),
      routeTreeRoutes: {
        __root__: { children: ['/level-one'] } as any,
        '/level-one': {
          filePath: '/routes/level-one.tsx',
          children: ['/level-two'],
        },
        '/level-two': {
          filePath: '/routes/level-two.tsx',
          children: ['/level-three'],
        },
        '/level-three': { filePath: '/routes/level-three.tsx' },
      },
      basePath: '/assets',
    })

    expect(manifest.routes.__root__!.css).toEqual([
      makeStylesheetLink('/assets/shared-root.css'),
      makeStylesheetLink('/assets/root.css'),
    ])
    expect(manifest.routes.__root__!.preloads).toEqual([
      '/assets/entry.js',
      '/assets/shared-root.js',
    ])
    expect(manifest.routes['/level-one']!.css).toEqual([
      makeStylesheetLink('/assets/level-one.css'),
    ])
    expect(manifest.routes['/level-one']!.preloads).toEqual([
      '/assets/level-one.js',
      '/assets/level-one-only.js',
    ])
    expect(manifest.routes['/level-two']!.css).toEqual([
      makeStylesheetLink('/assets/level-two.css'),
    ])
    expect(manifest.routes['/level-two']!.preloads).toEqual([
      '/assets/level-two.js',
      '/assets/level-two-only.js',
    ])
    expect(manifest.routes['/level-three']!.css).toEqual([
      makeStylesheetLink('/assets/level-three.css'),
    ])
    expect(manifest.routes['/level-three']!.preloads).toEqual([
      '/assets/level-three.js',
      '/assets/level-three-only.js',
    ])
  })

  test('throws when non-root route has no filePath', () => {
    const entryChunk = makeChunk({
      fileName: 'entry.js',
      isEntry: true,
    })

    expect(() =>
      buildStartManifest({
        clientBuild: normalizeViteClientBuild({ 'entry.js': entryChunk }),
        routeTreeRoutes: {
          __root__: { filePath: '/routes/__root.tsx', children: ['/about'] },
          '/about': {} as any,
        },
        basePath: '/assets',
      }),
    ).toThrow('expected filePath to be set for /about')
  })

  test('throws a descriptive error when a child route is missing from the tree', () => {
    const entryChunk = makeChunk({
      fileName: 'entry.js',
      isEntry: true,
      importedCss: ['entry.css'],
    })

    expect(() =>
      buildStartManifest({
        clientBuild: normalizeViteClientBuild({ 'entry.js': entryChunk }),
        routeTreeRoutes: {
          __root__: { children: ['/about'] } as any,
        },
        basePath: '/assets',
      }),
    ).toThrow(
      'Route tree references child route /about from __root__, but no route entry was found',
    )
  })
})

describe('multi-chunk routes must merge assets and preloads', () => {
  test('route with component and loader chunks includes assets from both', () => {
    const entryChunk = makeChunk({
      fileName: 'entry.js',
      isEntry: true,
      importedCss: ['entry.css'],
    })
    // Two separate chunks for the same route file (component + loader splits)
    const componentChunk = makeChunk({
      fileName: 'posts-component.js',
      imports: ['component-styles.js'],
      moduleIds: ['/routes/posts.tsx?tsr-split=component'],
    })
    const loaderChunk = makeChunk({
      fileName: 'posts-loader.js',
      imports: ['loader-dep.js'],
      moduleIds: ['/routes/posts.tsx?tsr-split=loader'],
    })
    const componentStylesChunk = makeChunk({
      fileName: 'component-styles.js',
      importedCss: ['component.css'],
    })
    const loaderDepChunk = makeChunk({
      fileName: 'loader-dep.js',
      importedCss: ['loader.css'],
    })

    const manifest = buildStartManifest({
      clientBuild: normalizeViteClientBuild({
        'entry.js': entryChunk,
        'posts-component.js': componentChunk,
        'posts-loader.js': loaderChunk,
        'component-styles.js': componentStylesChunk,
        'loader-dep.js': loaderDepChunk,
      }),
      routeTreeRoutes: {
        __root__: { children: ['/posts'] } as any,
        '/posts': { filePath: '/routes/posts.tsx' },
      },
      basePath: '/assets',
    })

    const postsRoute = manifest.routes['/posts']!

    // Both chunks' CSS should be present
    const cssHrefs = postsRoute.css!.map(getManifestCssHref)
    expect(cssHrefs).toContain('/assets/component.css')
    expect(cssHrefs).toContain('/assets/loader.css')

    // Both chunks' preloads should be present
    expect(postsRoute.preloads).toContain('/assets/posts-component.js')
    expect(postsRoute.preloads).toContain('/assets/posts-loader.js')
    expect(postsRoute.preloads).toContain('/assets/component-styles.js')
    expect(postsRoute.preloads).toContain('/assets/loader-dep.js')
  })

  test('route with overlapping chunk dependencies dedupes merged assets and preloads', () => {
    const entryChunk = makeChunk({
      fileName: 'entry.js',
      isEntry: true,
      importedCss: ['entry.css'],
    })
    const sharedDep = makeChunk({
      fileName: 'shared-dep.js',
      importedCss: ['shared.css'],
    })
    const componentChunk = makeChunk({
      fileName: 'posts-component.js',
      imports: ['shared-dep.js'],
      moduleIds: ['/routes/posts.tsx?tsr-split=component'],
    })
    const loaderChunk = makeChunk({
      fileName: 'posts-loader.js',
      imports: ['shared-dep.js'],
      moduleIds: ['/routes/posts.tsx?tsr-split=loader'],
    })

    const manifest = buildStartManifest({
      clientBuild: normalizeViteClientBuild({
        'entry.js': entryChunk,
        'shared-dep.js': sharedDep,
        'posts-component.js': componentChunk,
        'posts-loader.js': loaderChunk,
      }),
      routeTreeRoutes: {
        __root__: { children: ['/posts'] } as any,
        '/posts': { filePath: '/routes/posts.tsx' },
      },
      basePath: '/assets',
    })

    const postsRoute = manifest.routes['/posts']!
    const cssHrefs = postsRoute.css!.map(getManifestCssHref)
    const preloadHrefs = postsRoute.preloads!

    expect(
      cssHrefs.filter((href: string) => href === '/assets/shared.css'),
    ).toHaveLength(1)
    expect(
      preloadHrefs.filter((href: string) => href === '/assets/shared-dep.js'),
    ).toHaveLength(1)
  })
})

describe('buildStartManifest route pruning', () => {
  test('routes with no manifest data are pruned from returned manifest', () => {
    const entryChunk = makeChunk({
      fileName: 'entry.js',
      isEntry: true,
      importedCss: ['entry.css'],
    })

    const manifest = buildStartManifest({
      clientBuild: normalizeViteClientBuild({
        'entry.js': entryChunk,
      }),
      routeTreeRoutes: {
        __root__: { children: ['/about'] } as any,
        '/about': { filePath: '/routes/about.tsx' },
      },
      basePath: '/assets',
    })

    // /about has no matching chunks, so no manifest data.
    // It should be pruned from the manifest.
    expect(manifest.routes['/about']).toBeUndefined()
  })
})
