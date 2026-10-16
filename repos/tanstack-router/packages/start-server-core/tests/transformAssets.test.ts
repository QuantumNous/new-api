import { describe, expect, it, vi } from 'vitest'
import {
  buildManifest,
  resolveTransformAssetsConfig,
  transformManifestAssets,
} from '../src/transformAssetUrls'
import type { ServerManifest } from '@tanstack/router-core'

describe('transformAssets', () => {
  it('supports string shorthand', async () => {
    const config = resolveTransformAssetsConfig('https://cdn.example.com')

    expect(config.type).toBe('transform')
    if (config.type !== 'transform') {
      throw new Error('expected transform config')
    }

    expect(
      config.transformFn({
        kind: 'script',
        url: '/assets/app.js',
      }),
    ).toEqual({ href: 'https://cdn.example.com/assets/app.js' })
  })

  it('supports object return values with crossOrigin', async () => {
    const manifest = await transformManifestAssets(
      {
        routes: {
          __root__: {
            preloads: ['/assets/app.js'],
            css: ['/assets/app.css'],
            scripts: [
              {
                attrs: {
                  type: 'module',
                  async: true,
                  src: '/assets/entry.js',
                },
              },
            ],
          },
        },
      },
      (context) => {
        if (context.kind === 'script') {
          return {
            href: `https://cdn.example.com${context.url}`,
            crossOrigin: 'anonymous',
          }
        }

        return { href: `https://cdn.example.com${context.url}` }
      },
      { clone: true },
    )

    expect(manifest.routes.__root__?.preloads).toEqual([
      {
        href: 'https://cdn.example.com/assets/app.js',
        crossOrigin: 'anonymous',
      },
    ])
    expect(manifest.routes.__root__?.css?.[0]).toBe(
      'https://cdn.example.com/assets/app.css',
    )
    expect(manifest.routes.__root__?.scripts?.[0]).toEqual({
      attrs: {
        type: 'module',
        async: true,
        src: 'https://cdn.example.com/assets/entry.js',
        crossOrigin: 'anonymous',
      },
    })
  })

  it('preserves string preload format when transform returns no crossOrigin', async () => {
    const manifest = await transformManifestAssets(
      {
        routes: {
          __root__: {
            preloads: ['/assets/app.js'],
          },
        },
      },
      ({ url }) => ({ href: `https://cdn.example.com${url}` }),
      { clone: true },
    )

    expect(manifest.routes.__root__?.preloads?.[0]).toBe(
      'https://cdn.example.com/assets/app.js',
    )
  })

  it('passes script context for manifest preloads and scripts', async () => {
    const transformFn = vi.fn(({ url }) => ({
      href: `https://cdn.example.com${url}`,
    }))

    await transformManifestAssets(
      {
        scriptFormat: 'iife',
        routes: {
          __root__: {
            preloads: ['/assets/app.js'],
            scripts: [{ attrs: { src: '/assets/entry.js' } }],
          },
        },
      },
      transformFn,
    )

    expect(transformFn.mock.calls).toEqual([
      [{ kind: 'script', url: '/assets/app.js' }],
      [{ kind: 'script', url: '/assets/entry.js' }],
    ])
  })

  it('reuses transformed URLs for matching preload and script tags', async () => {
    let signature = 0
    const transformFn = vi.fn(({ url }) => ({
      href: `https://cdn.example.com${url}?sig=${++signature}`,
    }))

    const manifest = await transformManifestAssets(
      {
        routes: {
          __root__: {
            preloads: ['/assets/entry.js'],
            scripts: [
              {
                attrs: {
                  type: 'module',
                  async: true,
                  src: '/assets/entry.js',
                },
              },
            ],
          },
        },
      },
      transformFn,
    )

    const preload = manifest.routes.__root__?.preloads?.[0]
    const script = manifest.routes.__root__?.scripts?.[0]
    expect(preload).toBe(script?.attrs?.src)
    expect(transformFn.mock.calls).toEqual([
      [{ kind: 'script', url: '/assets/entry.js' }],
    ])
  })

  it('keeps root route boot scripts before an iife client entry', async () => {
    const transformFn = vi.fn(({ url }) => ({
      href: `https://cdn.example.com${url}`,
    }))

    const manifest = await transformManifestAssets(
      {
        scriptFormat: 'iife',
        routes: {
          __root__: {
            preloads: ['/assets/runtime.js', '/assets/entry.js'],
            scripts: [
              { attrs: { src: '/assets/runtime.js' } },
              { attrs: { src: '/assets/entry.js' } },
            ],
          },
        },
      },
      transformFn,
    )

    expect(manifest.routes.__root__?.preloads).toEqual([
      'https://cdn.example.com/assets/runtime.js',
      'https://cdn.example.com/assets/entry.js',
    ])
    expect(manifest.routes.__root__?.scripts).toEqual([
      { attrs: { src: 'https://cdn.example.com/assets/runtime.js' } },
      { attrs: { src: 'https://cdn.example.com/assets/entry.js' } },
    ])
    expect(transformFn.mock.calls).toEqual([
      [{ kind: 'script', url: '/assets/runtime.js' }],
      [{ kind: 'script', url: '/assets/entry.js' }],
    ])
  })

  it('does not mutate the source manifest', async () => {
    const source: ServerManifest = {
      routes: {
        __root__: {
          preloads: ['/assets/app.js'],
          css: ['/assets/app.css'],
        },
      },
    }

    const manifest = await transformManifestAssets(source, ({ url }) => ({
      href: `https://cdn.example.com${url}`,
    }))

    expect(manifest.routes.__root__?.preloads?.[0]).toBe(
      'https://cdn.example.com/assets/app.js',
    )
    expect(source.routes.__root__?.preloads?.[0]).toBe('/assets/app.js')
    expect(source.routes.__root__?.css?.[0]).toBe('/assets/app.css')
  })

  it('transforms manifest stylesheet links', async () => {
    const transformFn = vi.fn(({ url }) => ({
      href: `https://cdn.example.com${url}`,
    }))

    const manifest = await transformManifestAssets(
      {
        routes: {
          __root__: {
            preloads: [],
            css: ['/assets/app.css'],
          },
        },
      },
      transformFn,
      { clone: true },
    )

    expect(transformFn).toHaveBeenCalledWith({
      kind: 'stylesheet',
      url: '/assets/app.css',
    })
    expect(manifest.routes.__root__?.css).toEqual([
      'https://cdn.example.com/assets/app.css',
    ])
    expect(manifest.routes.__root__?.scripts).toBeUndefined()
  })

  it('transforms existing manifest route script src values', async () => {
    const manifest = await transformManifestAssets(
      {
        routes: {
          __root__: {
            scripts: [
              {
                attrs: {
                  src: '/assets/route-script.js',
                  type: 'module',
                },
              },
            ],
          },
        },
      },
      ({ url }) => ({ href: `https://cdn.example.com${url}` }),
      { clone: true },
    )

    expect(manifest.routes.__root__?.scripts?.[0]).toEqual({
      attrs: {
        src: 'https://cdn.example.com/assets/route-script.js',
        type: 'module',
      },
    })
  })

  it('transforms CSS URLs inside inlined stylesheet templates with css-url context', async () => {
    const transformFn = vi.fn((context) => {
      if (context.kind === 'css-url') {
        return `https://cdn.example.com${context.url}`
      }

      return context.url
    })

    const manifest = await transformManifestAssets(
      {
        inlineCss: {
          styles: {
            '/assets/app.css':
              '@font-face{src:url(/assets/font.woff2)}.card{background:url(/images/bg.png)}.icon{background:url(data:image/svg+xml,foo)}',
          },
          templates: {
            '/assets/app.css': {
              strings: [
                '@font-face{src:url("',
                '")}.card{background:url("',
                '")}.icon{background:url(data:image/svg+xml,foo)}',
              ],
              urls: ['/assets/font.woff2', '/images/bg.png'],
            },
          },
        },
        routes: {
          __root__: {
            css: ['/assets/app.css'],
          },
        },
      },
      transformFn,
    )

    expect(manifest.inlineCss?.styles['/assets/app.css']).toBe(
      '@font-face{src:url("https://cdn.example.com/assets/font.woff2")}.card{background:url("https://cdn.example.com/images/bg.png")}.icon{background:url(data:image/svg+xml,foo)}',
    )
    expect(transformFn).toHaveBeenCalledWith({
      kind: 'css-url',
      url: '/assets/font.woff2',
      stylesheetHref: '/assets/app.css',
    })
    expect(transformFn).toHaveBeenCalledWith({
      kind: 'css-url',
      url: '/images/bg.png',
      stylesheetHref: '/assets/app.css',
    })
    expect(transformFn).not.toHaveBeenCalledWith({
      kind: 'css-url',
      url: 'data:image/svg+xml,foo',
      stylesheetHref: '/assets/app.css',
    })
  })

  it('leaves inlined CSS URLs unchanged when template metadata is absent', async () => {
    const transformFn = vi.fn((context) => {
      if (context.kind === 'css-url') {
        return `https://cdn.example.com${context.url}`
      }

      return context.url
    })

    const manifest = await transformManifestAssets(
      {
        inlineCss: {
          styles: {
            '/assets/app.css': '.card{background:url(/images/bg.png)}',
          },
        },
        routes: {},
      },
      transformFn,
    )

    expect(manifest.inlineCss?.styles['/assets/app.css']).toBe(
      '.card{background:url(/images/bg.png)}',
    )
    expect(transformFn).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'css-url' }),
    )
  })

  it('does not transform stylesheet link hrefs when inline CSS is enabled', async () => {
    const transformFn = vi.fn((context) => {
      if (context.kind === 'stylesheet') {
        return `https://cdn.example.com${context.url}`
      }

      return context.url
    })

    const manifest = await transformManifestAssets(
      {
        inlineCss: {
          styles: {
            '/assets/app.css': '.root{color:red}',
          },
        },
        routes: {
          __root__: {
            css: ['/assets/app.css'],
          },
        },
      },
      transformFn,
    )

    expect(manifest.routes.__root__?.css?.[0]).toBe('/assets/app.css')
    expect(transformFn).not.toHaveBeenCalledWith({
      kind: 'stylesheet',
      url: '/assets/app.css',
    })
  })

  it('preserves inline CSS style order when template transforms resolve out of order', async () => {
    const resolvers = new Map<string, (value: string) => void>()
    const transformFn = vi.fn((context) => {
      if (context.kind !== 'css-url') {
        return context.url
      }

      return new Promise<string>((resolve) => {
        resolvers.set(context.url, resolve)
      })
    })

    const manifestPromise = transformManifestAssets(
      {
        inlineCss: {
          styles: {
            '/assets/a.css': '.a{background:url(/assets/a.png)}',
            '/assets/b.css': '.b{background:url(/assets/b.png)}',
          },
          templates: {
            '/assets/a.css': {
              strings: ['.a{background:url("', '")}'],
              urls: ['/assets/a.png'],
            },
            '/assets/b.css': {
              strings: ['.b{background:url("', '")}'],
              urls: ['/assets/b.png'],
            },
          },
        },
        routes: {},
      },
      transformFn,
    )

    await vi.waitFor(() => {
      expect(resolvers.size).toBe(2)
    })

    resolvers.get('/assets/b.png')!('https://cdn.example.com/assets/b.png')
    resolvers.get('/assets/a.png')!('https://cdn.example.com/assets/a.png')

    const manifest = await manifestPromise

    expect(Object.keys(manifest.inlineCss!.styles)).toEqual([
      '/assets/a.css',
      '/assets/b.css',
    ])
    expect(manifest.inlineCss?.styles['/assets/a.css']).toBe(
      '.a{background:url("https://cdn.example.com/assets/a.png")}',
    )
    expect(manifest.inlineCss?.styles['/assets/b.css']).toBe(
      '.b{background:url("https://cdn.example.com/assets/b.png")}',
    )
  })

  it('clones inline CSS when building a manifest without transforms', () => {
    const source: ServerManifest = {
      inlineCss: {
        styles: {
          '/assets/app.css': '.app{color:red}',
        },
        templates: {
          '/assets/app.css': {
            strings: ['.app{background:url("', '")}'],
            urls: ['/assets/bg.png'],
          },
        },
      },
      routes: {
        __root__: {},
      },
    }

    const manifest = buildManifest(source)
    manifest.inlineCss!.styles['/assets/app.css'] = '.mutated{}'
    manifest.inlineCss!.templates!['/assets/app.css']!.urls[0] =
      '/assets/mutated.png'

    expect(source.inlineCss!.styles['/assets/app.css']).toBe('.app{color:red}')
    expect(source.inlineCss!.templates!['/assets/app.css']!.urls[0]).toBe(
      '/assets/bg.png',
    )
  })

  describe('object shorthand', () => {
    it('supports { prefix } - same as string shorthand', () => {
      const config = resolveTransformAssetsConfig({
        prefix: 'https://cdn.example.com',
      })

      expect(config.type).toBe('transform')
      expect(config.cache).toBe(true)
      if (config.type !== 'transform') throw new Error('expected transform')

      expect(
        config.transformFn({
          kind: 'script',
          url: '/assets/app.js',
        }),
      ).toEqual({ href: 'https://cdn.example.com/assets/app.js' })
    })

    it('supports { prefix, crossOrigin: string } - uniform crossOrigin', () => {
      const config = resolveTransformAssetsConfig({
        prefix: 'https://cdn.example.com',
        crossOrigin: 'anonymous',
      })

      if (config.type !== 'transform') throw new Error('expected transform')

      expect(
        config.transformFn({
          kind: 'script',
          url: '/assets/app.js',
        }),
      ).toEqual({
        href: 'https://cdn.example.com/assets/app.js',
        crossOrigin: 'anonymous',
      })

      expect(
        config.transformFn({ kind: 'stylesheet', url: '/assets/app.css' }),
      ).toEqual({
        href: 'https://cdn.example.com/assets/app.css',
        crossOrigin: 'anonymous',
      })

      expect(
        config.transformFn({
          kind: 'css-url',
          url: '/assets/font.woff2',
          stylesheetHref: '/assets/app.css',
        }),
      ).toEqual({
        href: 'https://cdn.example.com/assets/font.woff2',
      })
    })

    it('supports { prefix, crossOrigin: per-kind } - different crossOrigin per kind', () => {
      const config = resolveTransformAssetsConfig({
        prefix: 'https://cdn.example.com',
        crossOrigin: {
          script: 'anonymous',
          stylesheet: 'use-credentials',
        },
      })

      if (config.type !== 'transform') throw new Error('expected transform')

      expect(
        config.transformFn({
          kind: 'script',
          url: '/assets/app.js',
        }),
      ).toEqual({
        href: 'https://cdn.example.com/assets/app.js',
        crossOrigin: 'anonymous',
      })

      expect(
        config.transformFn({ kind: 'stylesheet', url: '/assets/app.css' }),
      ).toEqual({
        href: 'https://cdn.example.com/assets/app.css',
        crossOrigin: 'use-credentials',
      })
    })

    it('supports empty-string prefix shorthand', () => {
      const config = resolveTransformAssetsConfig('')

      if (config.type !== 'transform') throw new Error('expected transform')

      expect(
        config.transformFn({
          kind: 'script',
          url: '/assets/app.js',
        }),
      ).toEqual({ href: '/assets/app.js' })
    })

    it('applies object shorthand crossOrigin to manifest stylesheets, preloads, and scripts', async () => {
      const config = resolveTransformAssetsConfig({
        prefix: 'https://cdn.example.com',
        crossOrigin: {
          script: 'anonymous',
          stylesheet: 'use-credentials',
        },
      })

      if (config.type !== 'transform') throw new Error('expected transform')

      const manifest = await transformManifestAssets(
        {
          routes: {
            __root__: {
              preloads: ['/assets/app.js'],
              css: ['/assets/app.css'],
              scripts: [{ attrs: { src: '/assets/entry.js' } }],
            },
          },
        },
        config.transformFn,
        { clone: true },
      )

      expect(manifest.routes.__root__?.preloads).toEqual([
        {
          href: 'https://cdn.example.com/assets/app.js',
          crossOrigin: 'anonymous',
        },
      ])

      expect(manifest.routes.__root__?.css?.[0]).toEqual({
        href: 'https://cdn.example.com/assets/app.css',
        crossOrigin: 'use-credentials',
      })
      expect(manifest.routes.__root__?.scripts?.[0]).toEqual({
        attrs: {
          src: 'https://cdn.example.com/assets/entry.js',
          crossOrigin: 'anonymous',
        },
      })
    })
  })
})
