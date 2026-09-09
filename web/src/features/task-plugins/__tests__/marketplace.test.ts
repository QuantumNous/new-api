/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import { describe, expect, test } from 'vitest'

import {
  deriveInstallState,
  findMarketplaceVersion,
  GITHUB_MARKETPLACE_INDEX_URL,
  indexHasIntegrityHashes,
  isDefaultMarketplaceSource,
  isStaleFactoryOverride,
  marketplaceBuiltInVersion,
  parseMarketplaceIndex,
  resolvePluginSourceUrl,
} from '../lib/marketplace'
import type {
  MarketplaceIndex,
  MarketplacePlugin,
  TaskPluginListItem,
} from '../types'

const OFFICIAL_INDEX_URL = 'https://www.newapi.ai/api/v1/plugins/index.json'

function marketplacePlugin(
  overrides: Partial<MarketplacePlugin> = {}
): MarketplacePlugin {
  return {
    key: 'doubao',
    name: 'doubao-video',
    latest: '1.2.0',
    versions: [
      { version: '1.2.0', path: 'plugins/tasks/doubao/1.2.0/plugin.js' },
      { version: '1.0.0', path: 'plugins/tasks/doubao/1.0.0/plugin.js' },
    ],
    ...overrides,
  }
}

function factoryMeta(key: string, version: string) {
  return {
    apiVersion: 1,
    key,
    name: key,
    version,
    author: { name: 'test' as const },
    models: null,
    fetchMode: 'poll',
  }
}

function installedPlugin(
  key: string,
  version: string,
  overrides: Partial<TaskPluginListItem> = {}
): TaskPluginListItem {
  return {
    meta: {
      apiVersion: 1,
      key,
      name: key,
      version,
      author: { name: 'test' },
      models: null,
      fetchMode: 'poll',
    },
    source: 'override',
    enabled: true,
    active: true,
    source_hash: 'hash',
    remark: '',
    runtime_status: 'registered',
    channel_count: 0,
    in_flight_count: 0,
    ...overrides,
  }
}

describe('marketplace source path resolution', () => {
  test('resolves a relative path against the directory holding the index', () => {
    expect(
      resolvePluginSourceUrl(
        'https://host.example/x/index.json',
        'plugins/tasks/doubao/1.0.0/plugin.js'
      )
    ).toBe('https://host.example/x/plugins/tasks/doubao/1.0.0/plugin.js')
  })

  test('resolves against a root index without dropping the path', () => {
    expect(
      resolvePluginSourceUrl(OFFICIAL_INDEX_URL, 'x/1.0.0/plugin.js')
    ).toBe('https://www.newapi.ai/api/v1/plugins/x/1.0.0/plugin.js')
  })

  test('resolves a root-relative path against the index origin', () => {
    expect(
      resolvePluginSourceUrl(
        'https://host.example/x/index.json',
        '/other/plugin.js'
      )
    ).toBe('https://host.example/other/plugin.js')
  })

  test('rejects a path that resolves to a different origin', () => {
    expect(
      resolvePluginSourceUrl(
        'https://host.example/x/index.json',
        'https://evil.example/plugin.js'
      )
    ).toBe(null)
  })

  test('rejects an empty path', () => {
    expect(resolvePluginSourceUrl(OFFICIAL_INDEX_URL, '  ')).toBe(null)
  })

  test('rejects an index URL that is not a valid absolute URL', () => {
    expect(resolvePluginSourceUrl('not-a-url', 'plugin.js')).toBe(null)
  })
})

describe('marketplace index parsing', () => {
  test('keeps plugins whose kind is absent or task', () => {
    const index = parseMarketplaceIndex({
      indexVersion: 1,
      name: 'Official',
      plugins: [
        {
          key: 'no-kind',
          latest: '1.0.0',
          versions: [{ version: '1.0.0', path: 'a/plugin.js' }],
        },
        {
          key: 'task-kind',
          latest: '1.0.0',
          versions: [{ version: '1.0.0', path: 'b/plugin.js', kind: 'task' }],
        },
      ],
    })
    expect(index.plugins.map((plugin) => plugin.key)).toStrictEqual([
      'no-kind',
      'task-kind',
    ])
  })

  test('drops a plugin whose only version declares an unsupported kind', () => {
    const index = parseMarketplaceIndex({
      indexVersion: 1,
      plugins: [
        {
          key: 'relay-only',
          latest: '1.0.0',
          versions: [{ version: '1.0.0', path: 'a/plugin.js', kind: 'relay' }],
        },
      ],
    })
    expect(index.plugins).toStrictEqual([])
  })

  test('carries the optional allowedHosts and auth declarations through', () => {
    const index = parseMarketplaceIndex({
      indexVersion: 1,
      plugins: [
        {
          key: 'doubao',
          latest: '1.0.0',
          versions: [
            {
              version: '1.0.0',
              path: 'a/plugin.js',
              sha256: 'abc',
              allowedHosts: ['ark.cn-beijing.volces.com'],
              auth: 'api_key',
            },
          ],
        },
      ],
    })
    expect(index.plugins[0].versions[0].allowedHosts).toStrictEqual([
      'ark.cn-beijing.volces.com',
    ])
    expect(index.plugins[0].versions[0].auth).toBe('api_key')
  })

  test('falls back to the first listed version when latest names an absent version', () => {
    const index = parseMarketplaceIndex({
      indexVersion: 1,
      plugins: [
        {
          key: 'doubao',
          latest: '9.9.9',
          versions: [{ version: '1.0.0', path: 'a/plugin.js' }],
        },
      ],
    })
    expect(index.plugins[0].latest).toBe('1.0.0')
  })

  test('skips malformed plugin entries instead of failing the whole source', () => {
    const index = parseMarketplaceIndex({
      indexVersion: 1,
      plugins: [
        null,
        { name: 'no key' },
        { key: 'no-versions', versions: [] },
        {
          key: 'ok',
          latest: '1.0.0',
          versions: [{ version: '1.0.0', path: 'a.js' }],
        },
      ],
    })
    expect(index.plugins.map((plugin) => plugin.key)).toStrictEqual(['ok'])
  })

  test('rejects an index version newer than this gateway understands', () => {
    expect(() =>
      parseMarketplaceIndex({ indexVersion: 2, plugins: [] })
    ).toThrow(/unsupported indexVersion 2/)
  })

  test('rejects a payload with no indexVersion', () => {
    expect(() => parseMarketplaceIndex({ plugins: [] })).toThrow(
      /missing indexVersion/
    )
  })

  test('rejects a non-object payload', () => {
    expect(() => parseMarketplaceIndex('<html>')).toThrow(/not an object/)
  })

  test('keeps a present icon string after trim', () => {
    const index = parseMarketplaceIndex({
      indexVersion: 1,
      plugins: [
        {
          key: 'sora',
          latest: '1.0.0',
          icon: '  Sora.Color  ',
          versions: [{ version: '1.0.0', path: 'a/plugin.js' }],
        },
      ],
    })
    expect(index.plugins[0].icon).toBe('Sora.Color')
  })

  test('omits icon when the field is absent', () => {
    const index = parseMarketplaceIndex({
      indexVersion: 1,
      plugins: [
        {
          key: 'sora',
          latest: '1.0.0',
          versions: [{ version: '1.0.0', path: 'a/plugin.js' }],
        },
      ],
    })
    expect(index.plugins[0].icon).toBe(undefined)
  })

  test('drops a non-string icon', () => {
    const index = parseMarketplaceIndex({
      indexVersion: 1,
      plugins: [
        {
          key: 'sora',
          latest: '1.0.0',
          icon: 12,
          versions: [{ version: '1.0.0', path: 'a/plugin.js' }],
        },
      ],
    })
    expect(index.plugins[0].icon).toBe(undefined)
  })

  test('keeps a bare string description from a legacy index', () => {
    const index = parseMarketplaceIndex({
      indexVersion: 1,
      plugins: [
        {
          key: 'kling',
          latest: '1.0.0',
          description: 'Video generation via Kling API',
          versions: [{ version: '1.0.0', path: 'a/plugin.js' }],
        },
      ],
    })
    expect(index.plugins[0].description).toBe('Video generation via Kling API')
  })

  test('keeps a LocalizedText object description from a current index', () => {
    const index = parseMarketplaceIndex({
      indexVersion: 1,
      plugins: [
        {
          key: 'kling',
          latest: '1.0.0',
          description: {
            en: 'Video generation via Kling API',
            zh: '可灵视频生成',
          },
          versions: [{ version: '1.0.0', path: 'a/plugin.js' }],
        },
      ],
    })
    expect(index.plugins[0].description).toStrictEqual({
      en: 'Video generation via Kling API',
      zh: '可灵视频生成',
    })
  })

  test('omits a non-string, non-object description', () => {
    const index = parseMarketplaceIndex({
      indexVersion: 1,
      plugins: [
        {
          key: 'kling',
          latest: '1.0.0',
          description: 12,
          versions: [{ version: '1.0.0', path: 'a/plugin.js' }],
        },
      ],
    })
    expect(index.plugins[0].description).toBe(undefined)
  })

  test('drops an icon longer than 128 characters', () => {
    const index = parseMarketplaceIndex({
      indexVersion: 1,
      plugins: [
        {
          key: 'sora',
          latest: '1.0.0',
          icon: 'A'.repeat(129),
          versions: [{ version: '1.0.0', path: 'a/plugin.js' }],
        },
      ],
    })
    expect(index.plugins[0].icon).toBe(undefined)
  })

  test('drops an inline data URI icon so logos only come from sidecar files', () => {
    const index = parseMarketplaceIndex({
      indexVersion: 1,
      plugins: [
        {
          key: 'sunoapi',
          latest: '1.0.0',
          icon: 'data:image/png;base64,iVBORw0KGgo=',
          versions: [{ version: '1.0.0', path: 'a/plugin.js' }],
        },
      ],
    })
    expect(index.plugins[0].icon).toBe(undefined)
  })

  test('drops a remote http icon so the marketplace page cannot beacon the author', () => {
    const index = parseMarketplaceIndex({
      indexVersion: 1,
      plugins: [
        {
          key: 'sunoapi',
          latest: '1.0.0',
          icon: 'https://evil.example/icon.png',
          versions: [{ version: '1.0.0', path: 'a/plugin.js' }],
        },
      ],
    })
    expect(index.plugins[0].icon).toBe(undefined)
  })

  test('keeps an iconFile entry pointing at an svg or png and drops other extensions', () => {
    const index = parseMarketplaceIndex({
      indexVersion: 1,
      plugins: [
        {
          key: 'incho',
          latest: '1.0.1',
          iconFile: { path: ' plugins/tasks/incho/icon.svg ', sha256: 'abc' },
          versions: [{ version: '1.0.1', path: 'a/plugin.js' }],
        },
        {
          key: 'other',
          latest: '1.0.0',
          iconFile: { path: 'plugins/tasks/other/icon.js' },
          versions: [{ version: '1.0.0', path: 'b/plugin.js' }],
        },
      ],
    })
    expect(index.plugins[0].iconFile).toStrictEqual({
      path: 'plugins/tasks/incho/icon.svg',
      sha256: 'abc',
    })
    expect(index.plugins[1].iconFile).toBe(undefined)
  })

  test('keeps a version baseUrl after trim and omits a blank one', () => {
    const index = parseMarketplaceIndex({
      indexVersion: 1,
      plugins: [
        {
          key: 'sunoapi',
          latest: '1.1.0',
          versions: [
            {
              version: '1.1.0',
              path: 'a/plugin.js',
              baseUrl: ' http://127.0.0.1:8000 ',
            },
            { version: '1.0.0', path: 'b/plugin.js', baseUrl: '   ' },
          ],
        },
      ],
    })
    expect(index.plugins[0].versions[0].baseUrl).toBe('http://127.0.0.1:8000')
    expect(index.plugins[0].versions[1].baseUrl).toBe(undefined)
  })
})

describe('install state derivation', () => {
  test('reports not installed when no local plugin shares the key', () => {
    expect(deriveInstallState(marketplacePlugin(), [])).toStrictEqual({
      status: 'not_installed',
    })
  })

  test('reports up to date when the installed version equals latest', () => {
    expect(
      deriveInstallState(marketplacePlugin(), [
        installedPlugin('doubao', '1.2.0'),
      ])
    ).toStrictEqual({ status: 'up_to_date', installedVersion: '1.2.0' })
  })

  test('reports upgradable when an older listed version is installed', () => {
    expect(
      deriveInstallState(marketplacePlugin(), [
        installedPlugin('doubao', '1.0.0'),
      ])
    ).toStrictEqual({
      status: 'upgradable',
      installedVersion: '1.0.0',
      latestVersion: '1.2.0',
    })
  })

  test('reports diverged when the installed version is absent from the index', () => {
    expect(
      deriveInstallState(marketplacePlugin(), [
        installedPlugin('doubao', '3.0.0-local'),
      ])
    ).toStrictEqual({
      status: 'diverged',
      installedVersion: '3.0.0-local',
      latestVersion: '1.2.0',
    })
  })

  test('ignores installed plugins with a different key', () => {
    expect(
      deriveInstallState(marketplacePlugin(), [
        installedPlugin('kling', '1.2.0'),
      ])
    ).toStrictEqual({ status: 'not_installed' })
  })
})

describe('marketplace built-in version', () => {
  test('factory-served built-in version is the installed meta version', () => {
    expect(
      marketplaceBuiltInVersion(
        installedPlugin('doubao', '1.0.0', { source: 'factory' })
      )
    ).toBe('1.0.0')
  })

  test('overridden factory built-in version comes from factory_meta', () => {
    expect(
      marketplaceBuiltInVersion(
        installedPlugin('doubao', '1.2.0', {
          source: 'override_over_factory',
          factory_meta: factoryMeta('doubao', '1.0.0'),
        })
      )
    ).toBe('1.0.0')
  })
})

describe('stale factory override', () => {
  test('is stale when override version differs from built-in', () => {
    expect(
      isStaleFactoryOverride(
        installedPlugin('doubao', '1.2.0', {
          source: 'override_over_factory',
          factory_meta: factoryMeta('doubao', '1.0.0'),
        })
      )
    ).toBe(true)
  })

  test('is not stale when override version matches built-in', () => {
    expect(
      isStaleFactoryOverride(
        installedPlugin('doubao', '1.0.0', {
          source: 'override_over_factory',
          factory_meta: factoryMeta('doubao', '1.0.0'),
        })
      )
    ).toBe(false)
  })

  test('is not stale for factory-served or third-party plugins', () => {
    expect(
      isStaleFactoryOverride(
        installedPlugin('doubao', '1.0.0', { source: 'factory' })
      )
    ).toBe(false)
    expect(isStaleFactoryOverride(installedPlugin('doubao', '1.0.0'))).toBe(
      false
    )
  })
})

describe('marketplace version lookup', () => {
  test('finds the entry matching a version', () => {
    expect(findMarketplaceVersion(marketplacePlugin(), '1.0.0')?.path).toBe(
      'plugins/tasks/doubao/1.0.0/plugin.js'
    )
  })

  test('returns undefined for an unknown version', () => {
    expect(findMarketplaceVersion(marketplacePlugin(), '9.9.9')).toBe(undefined)
  })
})

describe('source integrity and trust labels', () => {
  function index(plugins: MarketplacePlugin[]): MarketplaceIndex {
    return { indexVersion: 1, name: 'test', plugins }
  }

  test('treats a source as verified only when every version carries a hash', () => {
    expect(
      indexHasIntegrityHashes(
        index([
          marketplacePlugin({
            versions: [
              { version: '1.2.0', path: 'a.js', sha256: 'aa' },
              { version: '1.0.0', path: 'b.js', sha256: 'bb' },
            ],
          }),
        ])
      )
    ).toBe(true)
  })

  test('treats a partially hashed source as unverified', () => {
    expect(
      indexHasIntegrityHashes(
        index([
          marketplacePlugin({
            versions: [
              { version: '1.2.0', path: 'a.js', sha256: 'aa' },
              { version: '1.0.0', path: 'b.js' },
            ],
          }),
        ])
      )
    ).toBe(false)
  })

  test('treats an empty index as unverified rather than trivially verified', () => {
    expect(indexHasIntegrityHashes(index([]))).toBe(false)
  })

  test('labels both built-in index URLs as official sources', () => {
    expect(isDefaultMarketplaceSource(OFFICIAL_INDEX_URL)).toBe(true)
    expect(isDefaultMarketplaceSource(` ${OFFICIAL_INDEX_URL} `)).toBe(true)
    expect(isDefaultMarketplaceSource(GITHUB_MARKETPLACE_INDEX_URL)).toBe(true)
  })

  test('labels any other index URL as third-party', () => {
    expect(
      isDefaultMarketplaceSource('https://mirror.example/index.json')
    ).toBe(false)
  })
})

describe('marketplace display metadata', () => {
  test('sorts by descending priority and ascending key with zero defaults', () => {
    const index = parseMarketplaceIndex({
      indexVersion: 1,
      plugins: [
        marketplacePlugin({ key: 'low', sortPriority: -10 }),
        marketplacePlugin({ key: 'zero' }),
        marketplacePlugin({ key: 'beta', sortPriority: 20 }),
        marketplacePlugin({ key: 'alpha', sortPriority: 20 }),
      ],
    })
    expect(index.plugins.map((plugin) => plugin.key)).toStrictEqual([
      'alpha',
      'beta',
      'zero',
      'low',
    ])
  })

  test.each([1.5, '2', null, Number.NaN, Infinity, -2147483649, 2147483648])(
    'defaults invalid priority %s to zero',
    (sortPriority) => {
      const index = parseMarketplaceIndex({
        indexVersion: 1,
        plugins: [{ ...marketplacePlugin(), sortPriority }],
      })
      expect(index.plugins[0].sortPriority).toBe(0)
    }
  )

  test.each([-2147483648, 0, 2147483647])(
    'preserves priority %s',
    (sortPriority) => {
      const index = parseMarketplaceIndex({
        indexVersion: 1,
        plugins: [marketplacePlugin({ sortPriority })],
      })
      expect(index.plugins[0].sortPriority).toBe(sortPriority)
    }
  )

  test('preserves HTTPS website paths, queries and fragments', () => {
    const website = 'https://example.com/docs?q=1#intro'
    const index = parseMarketplaceIndex({
      indexVersion: 1,
      plugins: [marketplacePlugin({ website })],
    })
    expect(index.plugins[0].website).toBe(website)
  })

  test.each([
    '',
    'http://example.com',
    '/docs',
    'https:///docs',
    'https://user:pass@example.com',
    'https://@example.com',
    'javascript:alert(1)',
    'https://-example.com',
    'https://example.com:99999',
    'https://example.com/a b',
  ])('hides invalid website %s without dropping the plugin', (website) => {
    const index = parseMarketplaceIndex({
      indexVersion: 1,
      plugins: [marketplacePlugin({ website })],
    })
    expect(index.plugins.length).toBe(1)
    expect(index.plugins[0].website).toBe(undefined)
  })
})
