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
import assert from 'node:assert/strict'

import { describe, test } from 'vitest'

import {
  COMMUNITY_MARKETPLACE_INDEX_URL,
  deriveInstallState,
  findMarketplaceVersion,
  findRevokedEntry,
  GITHUB_MARKETPLACE_INDEX_URL,
  indexHasIntegrityHashes,
  isStaleFactoryOverride,
  marketplaceBuiltInVersion,
  marketplaceSourceKind,
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
    assert.equal(
      resolvePluginSourceUrl(
        'https://host.example/x/index.json',
        'plugins/tasks/doubao/1.0.0/plugin.js'
      ),
      'https://host.example/x/plugins/tasks/doubao/1.0.0/plugin.js'
    )
  })

  test('resolves against a root index without dropping the path', () => {
    assert.equal(
      resolvePluginSourceUrl(OFFICIAL_INDEX_URL, 'x/1.0.0/plugin.js'),
      'https://www.newapi.ai/api/v1/plugins/x/1.0.0/plugin.js'
    )
  })

  test('resolves a root-relative path against the index origin', () => {
    assert.equal(
      resolvePluginSourceUrl(
        'https://host.example/x/index.json',
        '/other/plugin.js'
      ),
      'https://host.example/other/plugin.js'
    )
  })

  test('rejects a path that resolves to a different origin', () => {
    assert.equal(
      resolvePluginSourceUrl(
        'https://host.example/x/index.json',
        'https://evil.example/plugin.js'
      ),
      null
    )
  })

  test('rejects an empty path', () => {
    assert.equal(resolvePluginSourceUrl(OFFICIAL_INDEX_URL, '  '), null)
  })

  test('rejects an index URL that is not a valid absolute URL', () => {
    assert.equal(resolvePluginSourceUrl('not-a-url', 'plugin.js'), null)
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
    assert.deepEqual(
      index.plugins.map((plugin) => plugin.key),
      ['no-kind', 'task-kind']
    )
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
    assert.deepEqual(index.plugins, [])
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
    assert.deepEqual(index.plugins[0].versions[0].allowedHosts, [
      'ark.cn-beijing.volces.com',
    ])
    assert.equal(index.plugins[0].versions[0].auth, 'api_key')
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
    assert.equal(index.plugins[0].latest, '1.0.0')
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
    assert.deepEqual(
      index.plugins.map((plugin) => plugin.key),
      ['ok']
    )
  })

  test('rejects an index version newer than this gateway understands', () => {
    assert.throws(
      () => parseMarketplaceIndex({ indexVersion: 2, plugins: [] }),
      /unsupported indexVersion 2/
    )
  })

  test('rejects a payload with no indexVersion', () => {
    assert.throws(
      () => parseMarketplaceIndex({ plugins: [] }),
      /missing indexVersion/
    )
  })

  test('rejects a non-object payload', () => {
    assert.throws(() => parseMarketplaceIndex('<html>'), /not an object/)
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
    assert.equal(index.plugins[0].icon, 'Sora.Color')
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
    assert.equal(index.plugins[0].icon, undefined)
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
    assert.equal(index.plugins[0].icon, undefined)
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
    assert.equal(index.plugins[0].description, 'Video generation via Kling API')
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
    assert.deepEqual(index.plugins[0].description, {
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
    assert.equal(index.plugins[0].description, undefined)
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
    assert.equal(index.plugins[0].icon, undefined)
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
    assert.equal(index.plugins[0].icon, undefined)
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
    assert.equal(index.plugins[0].icon, undefined)
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
    assert.deepEqual(index.plugins[0].iconFile, {
      path: 'plugins/tasks/incho/icon.svg',
      sha256: 'abc',
    })
    assert.equal(index.plugins[1].iconFile, undefined)
  })

  test('keeps an extensionless community icon file named by its digest', () => {
    const digest = 'a'.repeat(64)
    const index = parseMarketplaceIndex({
      indexVersion: 1,
      plugins: [
        {
          key: 'alice_foo',
          latest: '1.0.0',
          iconFile: { path: `files/${digest}`, sha256: digest },
          versions: [{ version: '1.0.0', path: `files/${'b'.repeat(64)}` }],
        },
      ],
    })
    assert.deepEqual(index.plugins[0].iconFile, {
      path: `files/${digest}`,
      sha256: digest,
    })
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
    assert.equal(index.plugins[0].versions[0].baseUrl, 'http://127.0.0.1:8000')
    assert.equal(index.plugins[0].versions[1].baseUrl, undefined)
  })
})

describe('install state derivation', () => {
  test('reports not installed when no local plugin shares the key', () => {
    assert.deepEqual(deriveInstallState(marketplacePlugin(), []), {
      status: 'not_installed',
    })
  })

  test('reports up to date when the installed version equals latest', () => {
    assert.deepEqual(
      deriveInstallState(marketplacePlugin(), [
        installedPlugin('doubao', '1.2.0'),
      ]),
      { status: 'up_to_date', installedVersion: '1.2.0' }
    )
  })

  test('reports upgradable when an older listed version is installed', () => {
    assert.deepEqual(
      deriveInstallState(marketplacePlugin(), [
        installedPlugin('doubao', '1.0.0'),
      ]),
      {
        status: 'upgradable',
        installedVersion: '1.0.0',
        latestVersion: '1.2.0',
      }
    )
  })

  test('reports diverged when the installed version is absent from the index', () => {
    assert.deepEqual(
      deriveInstallState(marketplacePlugin(), [
        installedPlugin('doubao', '3.0.0-local'),
      ]),
      {
        status: 'diverged',
        installedVersion: '3.0.0-local',
        latestVersion: '1.2.0',
      }
    )
  })

  test('ignores installed plugins with a different key', () => {
    assert.deepEqual(
      deriveInstallState(marketplacePlugin(), [
        installedPlugin('kling', '1.2.0'),
      ]),
      { status: 'not_installed' }
    )
  })
})

describe('marketplace built-in version', () => {
  test('factory-served built-in version is the installed meta version', () => {
    assert.equal(
      marketplaceBuiltInVersion(
        installedPlugin('doubao', '1.0.0', { source: 'factory' })
      ),
      '1.0.0'
    )
  })

  test('overridden factory built-in version comes from factory_meta', () => {
    assert.equal(
      marketplaceBuiltInVersion(
        installedPlugin('doubao', '1.2.0', {
          source: 'override_over_factory',
          factory_meta: factoryMeta('doubao', '1.0.0'),
        })
      ),
      '1.0.0'
    )
  })
})

describe('stale factory override', () => {
  test('is stale when override version differs from built-in', () => {
    assert.equal(
      isStaleFactoryOverride(
        installedPlugin('doubao', '1.2.0', {
          source: 'override_over_factory',
          factory_meta: factoryMeta('doubao', '1.0.0'),
        })
      ),
      true
    )
  })

  test('is not stale when override version matches built-in', () => {
    assert.equal(
      isStaleFactoryOverride(
        installedPlugin('doubao', '1.0.0', {
          source: 'override_over_factory',
          factory_meta: factoryMeta('doubao', '1.0.0'),
        })
      ),
      false
    )
  })

  test('is not stale for factory-served or third-party plugins', () => {
    assert.equal(
      isStaleFactoryOverride(
        installedPlugin('doubao', '1.0.0', { source: 'factory' })
      ),
      false
    )
    assert.equal(
      isStaleFactoryOverride(installedPlugin('doubao', '1.0.0')),
      false
    )
  })
})

describe('marketplace version lookup', () => {
  test('finds the entry matching a version', () => {
    assert.equal(
      findMarketplaceVersion(marketplacePlugin(), '1.0.0')?.path,
      'plugins/tasks/doubao/1.0.0/plugin.js'
    )
  })

  test('returns undefined for an unknown version', () => {
    assert.equal(
      findMarketplaceVersion(marketplacePlugin(), '9.9.9'),
      undefined
    )
  })
})

describe('source integrity and trust labels', () => {
  function index(plugins: MarketplacePlugin[]): MarketplaceIndex {
    return { indexVersion: 1, name: 'test', plugins }
  }

  test('treats a source as verified only when every version carries a hash', () => {
    assert.equal(
      indexHasIntegrityHashes(
        index([
          marketplacePlugin({
            versions: [
              { version: '1.2.0', path: 'a.js', sha256: 'aa' },
              { version: '1.0.0', path: 'b.js', sha256: 'bb' },
            ],
          }),
        ])
      ),
      true
    )
  })

  test('treats a partially hashed source as unverified', () => {
    assert.equal(
      indexHasIntegrityHashes(
        index([
          marketplacePlugin({
            versions: [
              { version: '1.2.0', path: 'a.js', sha256: 'aa' },
              { version: '1.0.0', path: 'b.js' },
            ],
          }),
        ])
      ),
      false
    )
  })

  test('treats an empty index as unverified rather than trivially verified', () => {
    assert.equal(indexHasIntegrityHashes(index([])), false)
  })

  test('labels both built-in index URLs as official sources', () => {
    assert.equal(marketplaceSourceKind(OFFICIAL_INDEX_URL), 'official')
    assert.equal(marketplaceSourceKind(` ${OFFICIAL_INDEX_URL} `), 'official')
    assert.equal(
      marketplaceSourceKind(GITHUB_MARKETPLACE_INDEX_URL),
      'official'
    )
  })

  test('labels the built-in community address as community', () => {
    assert.equal(
      marketplaceSourceKind(` ${COMMUNITY_MARKETPLACE_INDEX_URL} `),
      'community'
    )
  })

  test.each([
    'https://mirror.example/index.json',
    `${COMMUNITY_MARKETPLACE_INDEX_URL}?official=1`,
    OFFICIAL_INDEX_URL.replace('https:', 'http:'),
    'https://newapi.ai/api/v1/community/index.json',
  ])('labels %s as third-party', (indexUrl) => {
    assert.equal(marketplaceSourceKind(indexUrl), 'third_party')
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
    assert.deepEqual(
      index.plugins.map((plugin) => plugin.key),
      ['alpha', 'beta', 'zero', 'low']
    )
  })

  test.each([1.5, '2', null, Number.NaN, Infinity, -2147483649, 2147483648])(
    'defaults invalid priority %s to zero',
    (sortPriority) => {
      const index = parseMarketplaceIndex({
        indexVersion: 1,
        plugins: [{ ...marketplacePlugin(), sortPriority }],
      })
      assert.equal(index.plugins[0].sortPriority, 0)
    }
  )

  test.each([-2147483648, 0, 2147483647])(
    'preserves priority %s',
    (sortPriority) => {
      const index = parseMarketplaceIndex({
        indexVersion: 1,
        plugins: [marketplacePlugin({ sortPriority })],
      })
      assert.equal(index.plugins[0].sortPriority, sortPriority)
    }
  )

  test('preserves HTTPS website paths, queries and fragments', () => {
    const website = 'https://example.com/docs?q=1#intro'
    const index = parseMarketplaceIndex({
      indexVersion: 1,
      plugins: [marketplacePlugin({ website })],
    })
    assert.equal(index.plugins[0].website, website)
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
    assert.equal(index.plugins.length, 1)
    assert.equal(index.plugins[0].website, undefined)
  })
})

describe('community index fields', () => {
  const digest = 'c'.repeat(64)

  test('reads the author, repository, code, installs and recommendation', () => {
    const index = parseMarketplaceIndex({
      indexVersion: 1,
      plugins: [
        {
          ...marketplacePlugin({ key: 'alice_foo' }),
          author: { login: ' alice ', url: 'https://github.com/alice' },
          repo: 'https://github.com/alice/newapi-plugins',
          code: ' 40817265 ',
          installs30d: 12,
          recommended: true,
        },
      ],
    })
    const plugin = index.plugins[0]
    assert.deepEqual(plugin.author, {
      login: 'alice',
      url: 'https://github.com/alice',
    })
    assert.equal(plugin.repo, 'https://github.com/alice/newapi-plugins')
    assert.equal(plugin.code, '40817265')
    assert.equal(plugin.installs30d, 12)
    assert.equal(plugin.recommended, true)
  })

  test('drops malformed community fields without dropping the plugin', () => {
    const index = parseMarketplaceIndex({
      indexVersion: 1,
      plugins: [
        {
          ...marketplacePlugin({ key: 'alice_foo' }),
          author: { login: '', url: 'https://github.com/alice' },
          repo: 'javascript:alert(1)',
          installs30d: -1,
          recommended: 'yes',
        },
      ],
    })
    const plugin = index.plugins[0]
    assert.equal(plugin.author, undefined)
    assert.equal(plugin.repo, undefined)
    assert.equal(plugin.installs30d, undefined)
    assert.equal(plugin.recommended, false)
  })

  test('puts recommended plugins first, then the most installed', () => {
    const index = parseMarketplaceIndex({
      indexVersion: 1,
      plugins: [
        { ...marketplacePlugin({ key: 'a_few' }), installs30d: 3 },
        { ...marketplacePlugin({ key: 'a_many' }), installs30d: 50 },
        {
          ...marketplacePlugin({ key: 'a_pick' }),
          installs30d: 1,
          recommended: true,
        },
        marketplacePlugin({ key: 'a_none' }),
      ],
    })
    assert.deepEqual(
      index.plugins.map((plugin) => plugin.key),
      ['a_pick', 'a_many', 'a_few', 'a_none']
    )
  })

  test('reads takedown entries and skips ones without a valid digest', () => {
    const index = parseMarketplaceIndex({
      indexVersion: 1,
      plugins: [],
      revoked: [
        { sha256: ` ${digest.toUpperCase()} `, reason: { en: 'Steals keys' } },
        { sha256: 'not-a-digest', reason: 'ignored' },
        'junk',
      ],
    })
    assert.deepEqual(index.revoked, [
      { sha256: digest, key: undefined, reason: { en: 'Steals keys' } },
    ])
  })

  test('matches an installed plugin to a takedown entry by its code digest', () => {
    const index: MarketplaceIndex = {
      indexVersion: 1,
      name: '',
      plugins: [],
      revoked: [{ sha256: digest, reason: 'Steals keys' }],
    }
    assert.equal(
      findRevokedEntry(index, digest.toUpperCase())?.reason,
      'Steals keys'
    )
    assert.equal(findRevokedEntry(index, 'd'.repeat(64)), undefined)
    assert.equal(findRevokedEntry(index, ''), undefined)
    assert.equal(findRevokedEntry(undefined, digest), undefined)
  })
})

describe('version readme and changelog fields', () => {
  const digest = 'a'.repeat(64)
  const parseVersion = (fields: Record<string, unknown>) =>
    parseMarketplaceIndex({
      indexVersion: 1,
      plugins: [
        {
          key: 'alice_foo',
          versions: [{ version: '1.0.0', path: 'files/x', ...fields }],
        },
      ],
    }).plugins[0].versions[0]

  test('reads both files with their digests, pages and translations', () => {
    const version = parseVersion({
      readme: {
        path: ' files/readme ',
        sha256: digest.toUpperCase(),
        sourceUrl: 'https://github.com/alice/foo/blob/abc/README.md',
        translations: {
          'zh-CN': {
            path: 'files/readme-zh',
            sourceUrl: 'https://github.com/alice/foo/blob/abc/README.zh-CN.md',
          },
        },
      },
      changelog: { path: 'files/changelog' },
    })
    assert.deepEqual(version.readme, {
      path: 'files/readme',
      sha256: digest,
      sourceUrl: 'https://github.com/alice/foo/blob/abc/README.md',
      translations: {
        'zh-CN': {
          path: 'files/readme-zh',
          sha256: undefined,
          sourceUrl: 'https://github.com/alice/foo/blob/abc/README.zh-CN.md',
        },
      },
    })
    assert.deepEqual(version.changelog, {
      path: 'files/changelog',
      sha256: undefined,
      sourceUrl: undefined,
    })
  })

  test('a version from an older index has neither field', () => {
    const version = parseVersion({})
    assert.equal(version.readme, undefined)
    assert.equal(version.changelog, undefined)
  })

  const translations = (count: number) =>
    Object.fromEntries(
      ['de', 'es', 'fr', 'it', 'ja', 'ko', 'pt', 'ru', 'vi', 'zh-CN', 'zh-TW']
        .slice(0, count)
        .map((tag) => [tag, { path: `files/${tag}` }])
    )

  test.each([
    ['a missing path', { path: ' ' }],
    ['a malformed digest', { path: 'files/r', sha256: 'abc' }],
  ])('drops a file with %s and keeps the version', (_label, readme) => {
    const version = parseVersion({ readme, changelog: readme })
    assert.equal(version.version, '1.0.0')
    assert.equal(version.readme, undefined)
    assert.equal(version.changelog, undefined)
  })

  test('keeps an http page and drops only a malformed one', () => {
    const version = parseVersion({
      readme: { path: 'files/r', sourceUrl: 'http://git.example/a/README.md' },
      changelog: { path: 'files/c', sourceUrl: 'javascript:alert(1)' },
    })
    assert.equal(version.readme?.sourceUrl, 'http://git.example/a/README.md')
    assert.deepEqual(version.changelog, {
      path: 'files/c',
      sha256: undefined,
      sourceUrl: undefined,
    })
  })

  test('drops only the invalid translations and keeps the English file', () => {
    const version = parseVersion({
      readme: {
        path: 'files/r',
        translations: {
          en: { path: 'files/e' },
          'zh-cn': { path: 'files/z' },
          ja: {},
          fr: { path: 'files/fr', sha256: 'abc' },
          'zh-CN': { path: 'files/zh', sourceUrl: 'ftp://x.example/a' },
          ru: { path: 'files/ru' },
        },
      },
    })
    assert.equal(version.readme?.path, 'files/r')
    assert.deepEqual(version.readme?.translations, {
      'zh-CN': { path: 'files/zh', sha256: undefined, sourceUrl: undefined },
      ru: { path: 'files/ru', sha256: undefined, sourceUrl: undefined },
    })
  })

  test('a translations value that is not a map leaves the English file alone', () => {
    const version = parseVersion({
      readme: { path: 'files/r', translations: [] },
    })
    assert.deepEqual(version.readme, {
      path: 'files/r',
      sha256: undefined,
      sourceUrl: undefined,
    })
  })

  test('keeps the first 10 valid translations', () => {
    const version = parseVersion({
      readme: { path: 'files/r', translations: translations(11) },
    })
    assert.deepEqual(Object.keys(version.readme?.translations ?? {}), [
      'de',
      'es',
      'fr',
      'it',
      'ja',
      'ko',
      'pt',
      'ru',
      'vi',
      'zh-CN',
    ])
  })

  test('keeps 10 translations', () => {
    const version = parseVersion({
      readme: { path: 'files/r', translations: translations(10) },
    })
    assert.equal(Object.keys(version.readme?.translations ?? {}).length, 10)
  })
})
