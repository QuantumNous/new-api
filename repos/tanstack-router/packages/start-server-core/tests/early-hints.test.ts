import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  collectDynamicHintsFromMatches,
  collectStaticHintsFromManifest,
  createEarlyHintsCollector,
  createEarlyHintsEvent,
  getResponseLinkHeaderEntries,
  serializeEarlyHint,
} from '../src/early-hints'
import type { EarlyHint } from '../src/early-hints'
import type {
  AnyRoute,
  AnyRouteMatch,
  ServerManifest,
} from '@tanstack/router-core'

describe('early hints', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('formats Link header values', () => {
    const hints = [
      {
        href: '/assets/app.js',
        rel: 'modulepreload' as const,
        as: 'script' as const,
      },
      {
        href: '/assets/app.css',
        rel: 'preload' as const,
        as: 'style' as const,
        crossOrigin: 'anonymous' as const,
      },
      {
        href: '/assets/font.woff2',
        rel: 'preload' as const,
        as: 'font' as const,
        type: 'font/woff2',
        crossOrigin: '' as const,
        integrity: 'sha256-test',
        referrerPolicy: 'no-referrer',
        fetchPriority: 'high',
      },
    ]

    expect(hints.map(serializeEarlyHint)).toEqual([
      '</assets/app.js>; rel=modulepreload; as=script',
      '</assets/app.css>; rel=preload; as=style; crossorigin=anonymous',
      '</assets/font.woff2>; rel=preload; as=font; crossorigin; type="font/woff2"; integrity=sha256-test; referrerpolicy=no-referrer; fetchpriority=high',
    ])
    expect(serializeEarlyHint(hints[0]!)).toBe(
      '</assets/app.js>; rel=modulepreload; as=script',
    )
  })

  it('collects static route JS and stylesheet hints with crossOrigin', () => {
    const manifest: ServerManifest = {
      routes: {
        __root__: {
          preloads: [
            '/assets/root.js',
            { href: '/assets/shared.js', crossOrigin: 'anonymous' },
          ],
          css: [
            {
              href: '/assets/root.css',
              crossOrigin: 'use-credentials',
            },
          ],
        },
        '/posts': {
          preloads: ['/assets/posts.js'],
          css: ['/assets/posts.css'],
        },
      },
    }

    expect(
      collectStaticHintsFromManifest(manifest, [
        { id: '__root__' },
        { id: '/posts' },
      ] as Array<AnyRoute>),
    ).toEqual([
      { href: '/assets/root.js', rel: 'modulepreload', as: 'script' },
      {
        href: '/assets/shared.js',
        rel: 'modulepreload',
        as: 'script',
        crossOrigin: 'anonymous',
      },
      {
        href: '/assets/root.css',
        rel: 'preload',
        as: 'style',
        crossOrigin: 'use-credentials',
      },
      { href: '/assets/posts.js', rel: 'modulepreload', as: 'script' },
      { href: '/assets/posts.css', rel: 'preload', as: 'style' },
    ])
  })

  it('skips static stylesheet hints when inline CSS is enabled', () => {
    const manifest: ServerManifest = {
      inlineCss: {
        styles: {
          '/assets/posts.css': '.posts{}',
        },
      },
      routes: {
        '/posts': {
          preloads: ['/assets/posts.js'],
          css: ['/assets/posts.css'],
        },
      },
    }

    expect(
      collectStaticHintsFromManifest(manifest, [
        { id: '/posts' },
      ] as Array<AnyRoute>),
    ).toEqual([
      { href: '/assets/posts.js', rel: 'modulepreload', as: 'script' },
    ])
  })

  it('skips object-form static stylesheet hints when inline CSS is enabled', () => {
    const manifest: ServerManifest = {
      inlineCss: {
        styles: {
          '/assets/posts.css': '.posts{}',
        },
      },
      routes: {
        '/posts': {
          preloads: ['/assets/posts.js'],
          css: [
            {
              href: '/assets/posts.css',
              crossOrigin: 'use-credentials',
            },
          ],
        },
      },
    }

    expect(
      collectStaticHintsFromManifest(manifest, [
        { id: '/posts' },
      ] as Array<AnyRoute>),
    ).toEqual([
      { href: '/assets/posts.js', rel: 'modulepreload', as: 'script' },
    ])
  })

  it('collects static route JS hints as preload script for iife manifests', () => {
    const manifest: ServerManifest = {
      scriptFormat: 'iife',
      routes: {
        '/posts': {
          preloads: [
            '/assets/posts.js',
            { href: '/assets/shared.js', crossOrigin: 'anonymous' },
          ],
        },
      },
    }

    expect(
      collectStaticHintsFromManifest(manifest, [
        { id: '/posts' },
      ] as Array<AnyRoute>),
    ).toEqual([
      { href: '/assets/posts.js', rel: 'preload', as: 'script' },
      {
        href: '/assets/shared.js',
        rel: 'preload',
        as: 'script',
        crossOrigin: 'anonymous',
      },
    ])
  })

  it('collects dynamic hints from route head links', () => {
    const matches = [
      {
        routeId: '__root__',
        links: [
          { rel: 'stylesheet', href: '/root.css' },
          { rel: 'preconnect', href: 'https://fonts.example.com' },
          { rel: 'modulepreload', href: '/root-head.js' },
          { rel: 'icon', href: '/favicon.ico' },
        ],
      },
      {
        routeId: '/posts',
        links: [
          {
            rel: 'preload',
            href: '/hero.png',
            as: 'image',
          },
          { rel: 'preload', href: '/missing-as.bin' },
          { rel: 'dns-prefetch', href: 'https://api.example.com' },
        ],
      },
    ] as Array<AnyRouteMatch>

    expect(collectDynamicHintsFromMatches(matches)).toEqual([
      { href: '/root.css', rel: 'preload', as: 'style' },
      { href: 'https://fonts.example.com', rel: 'preconnect' },
      { href: '/root-head.js', rel: 'modulepreload', as: 'script' },
      {
        href: '/hero.png',
        rel: 'preload',
        as: 'image',
      },
      { href: 'https://api.example.com', rel: 'dns-prefetch' },
    ])
  })

  it('creates delta-only events across phases', () => {
    const sentLinks = new Set<string>()
    const sentHints: Array<EarlyHint> = []
    const staticEvent = createEarlyHintsEvent({
      phase: 'static',
      hints: [
        { href: '/assets/app.js', rel: 'modulepreload', as: 'script' },
        { href: '/assets/app.js', rel: 'modulepreload', as: 'script' },
        { href: '/assets/app.css', rel: 'preload', as: 'style' },
      ],
      sentLinks,
      sentHints,
    })!

    expect(staticEvent.hints).toEqual([
      { href: '/assets/app.js', rel: 'modulepreload', as: 'script' },
      { href: '/assets/app.css', rel: 'preload', as: 'style' },
    ])
    expect(staticEvent.links).toEqual([
      '</assets/app.js>; rel=modulepreload; as=script',
      '</assets/app.css>; rel=preload; as=style',
    ])
    expect(staticEvent.allHints).toEqual(staticEvent.hints)
    expect(staticEvent.allLinks).toEqual(staticEvent.links)

    const dynamicEvent = createEarlyHintsEvent({
      phase: 'dynamic',
      hints: [
        { href: '/assets/app.css', rel: 'preload', as: 'style' },
        { href: '/dynamic.css', rel: 'preload', as: 'style' },
      ],
      sentLinks,
      sentHints,
    })!

    expect(dynamicEvent.hints).toEqual([
      { href: '/dynamic.css', rel: 'preload', as: 'style' },
    ])
    expect(dynamicEvent.links).toEqual([
      '</dynamic.css>; rel=preload; as=style',
    ])
    expect(dynamicEvent.allHints).toEqual([
      { href: '/assets/app.js', rel: 'modulepreload', as: 'script' },
      { href: '/assets/app.css', rel: 'preload', as: 'style' },
      { href: '/dynamic.css', rel: 'preload', as: 'style' },
    ])
    expect(dynamicEvent.allLinks).toEqual([
      '</assets/app.js>; rel=modulepreload; as=script',
      '</assets/app.css>; rel=preload; as=style',
      '</dynamic.css>; rel=preload; as=style',
    ])
  })

  it('emits an empty dynamic event with no new links', () => {
    const sentLinks = new Set([
      '</assets/app.js>; rel=modulepreload; as=script',
    ])
    const sentHints = [
      {
        href: '/assets/app.js',
        rel: 'modulepreload' as const,
        as: 'script' as const,
      },
    ]

    expect(
      createEarlyHintsEvent({
        phase: 'dynamic',
        hints: [{ href: '/assets/app.js', rel: 'modulepreload', as: 'script' }],
        sentLinks,
        sentHints,
      }),
    ).toEqual({
      phase: 'dynamic',
      hints: [],
      links: [],
      allHints: [
        { href: '/assets/app.js', rel: 'modulepreload', as: 'script' },
      ],
      allLinks: ['</assets/app.js>; rel=modulepreload; as=script'],
    })
  })

  it('skips static events with no new links', () => {
    const sentLinks = new Set([
      '</assets/app.js>; rel=modulepreload; as=script',
    ])
    const sentHints = [
      {
        href: '/assets/app.js',
        rel: 'modulepreload' as const,
        as: 'script' as const,
      },
    ]

    expect(
      createEarlyHintsEvent({
        phase: 'static',
        hints: [{ href: '/assets/app.js', rel: 'modulepreload', as: 'script' }],
        sentLinks,
        sentHints,
      }),
    ).toBeUndefined()
  })

  it('returns response Link header entries with optional filtering', () => {
    const entries = [
      {
        phase: 'static' as const,
        hint: { href: '/assets/app.js', rel: 'modulepreload' as const },
        link: '</assets/app.js>; rel=modulepreload',
      },
      {
        phase: 'dynamic' as const,
        hint: { href: 'https://example.com', rel: 'preconnect' as const },
        link: '<https://example.com>; rel=preconnect',
      },
    ]

    expect(getResponseLinkHeaderEntries({ entries })).toEqual([
      '</assets/app.js>; rel=modulepreload',
      '<https://example.com>; rel=preconnect',
    ])
    expect(
      getResponseLinkHeaderEntries({
        entries,
        filter: ({ phase }) => phase === 'static',
      }),
    ).toEqual(['</assets/app.js>; rel=modulepreload'])
  })

  it('skips all response Link header entries when filtering throws', () => {
    const entries = [
      {
        phase: 'dynamic' as const,
        hint: { href: 'https://example.com', rel: 'preconnect' as const },
        link: '<https://example.com>; rel=preconnect',
      },
    ]

    expect(
      getResponseLinkHeaderEntries({
        entries,
        filter: () => {
          throw new Error('filter failed')
        },
      }),
    ).toEqual([])
  })

  it('creates a production-gated collector for callbacks and response Link headers', () => {
    const events: Array<unknown> = []
    const collector = createEarlyHintsCollector({
      onEarlyHints: (event) => {
        events.push(event)
      },
      responseLinkHeader: true,
    })!
    const manifest: ServerManifest = {
      routes: {
        __root__: {
          preloads: ['/assets/app.js'],
        },
      },
    }
    const headers = new Headers()

    collector.collectStatic({
      manifest,
      matchedRoutes: [{ id: '__root__' } as AnyRoute],
    })
    collector.collectDynamic([])
    collector.appendResponseHeaders(headers)

    expect(events).toHaveLength(2)
    expect(headers.get('Link')).toBe(
      '</assets/app.js>; rel=modulepreload; as=script',
    )
  })

  it('does not create a collector when no early-hints options are enabled', () => {
    expect(createEarlyHintsCollector(undefined)).toBeUndefined()
    expect(createEarlyHintsCollector({})).toBeUndefined()
  })

  it('does not create a collector in the dev server', () => {
    vi.stubEnv('TSS_DEV_SERVER', 'true')

    expect(
      createEarlyHintsCollector({
        onEarlyHints: () => {},
        responseLinkHeader: true,
      }),
    ).toBeUndefined()
  })
})
