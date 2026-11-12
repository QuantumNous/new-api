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
import { afterEach, describe, expect, test, vi } from 'vitest'

import { PluginDocumentDownloadError } from '../lib/plugin-document'
import { fetchPluginReadme, parsePluginReadme } from '../lib/plugin-readme'
import type { MarketplacePlugin } from '../types'

const sourceUrl = 'https://github.com/alice/demo/blob/abc/README.md'
const english = `---
translations:
  zh-CN: README.zh-CN.md
---
# Demo

Generates videos. Mail [support](mailto:help@example.com) or help@example.com.

## Channel setup

- Pick the **Demo** channel type.
  - See [the guide](docs/setup.md) and [the console][console].

| Field | Use |
| --- | --- |
| \`seconds\` | Video length |

[console]: https://console.example.com
`
const chinese = `---
locale: zh-CN
---
# Demo

生成视频。
`

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('usage guide format', () => {
  test('keeps the body without front matter and allows mail, relative and reference links', () => {
    const readme = parsePluginReadme(english, 'en', sourceUrl)
    expect(readme).toMatchObject({ locale: 'en', sourceUrl })
    expect(readme.markdown.startsWith('# Demo')).toBe(true)
  })

  test('a link definition may come before the title', () => {
    const text = '[site]: https://example.com\n\n# Demo\n\nSee [site].\n'
    expect(parsePluginReadme(text, 'en', sourceUrl).markdown).toBe(text)
  })

  test('front matter is optional', () => {
    expect(parsePluginReadme('# Demo\n', 'en', sourceUrl).markdown).toBe(
      '# Demo\n'
    )
  })

  test.each([
    [
      'an HTML block',
      english.replace('Generates videos.', '<div>x</div>'),
      'html',
      7,
    ],
    [
      'an HTML comment',
      english.replace('## Channel setup', '<!-- note -->'),
      'html',
      9,
    ],
    [
      'inline HTML in a nested list',
      english.replace('See [the guide]', 'See <b>bold</b> [the guide]'),
      'html',
      12,
    ],
    [
      'an image in a table row',
      english.replace('Video length', '![shot](https://other.example/a.png)'),
      'image',
      16,
    ],
    [
      'a script link',
      english.replace('docs/setup.md', 'javascript:alert(1)'),
      'link',
      12,
    ],
    [
      'a script reference link',
      english.replace(
        '[console]: https://console.example.com',
        '[console]: javascript:alert(1)'
      ),
      'link',
      12,
    ],
    [
      'a first block that is not a level-1 heading',
      english.replace('# Demo', '## Demo'),
      'title',
      5,
    ],
    [
      'unknown metadata',
      english.replace('translations:', 'author: alice\ntranslations:'),
      'front_matter',
      2,
    ],
    [
      'another locale in README.md',
      english.replace('---\n', '---\nlocale: ja\n'),
      'identity',
      2,
    ],
    [
      'a translation named after another file',
      english.replace('README.zh-CN.md', 'README.zh.md'),
      'translation',
      3,
    ],
  ])('rejects %s and says where', (_label, text, code, line) => {
    expect(() => parsePluginReadme(text, 'en', sourceUrl)).toThrow(
      expect.objectContaining({ file: 'README.md', code, line, sourceUrl })
    )
  })

  test('a translation names its own file and declares no translations', () => {
    expect(() =>
      parsePluginReadme(
        chinese.replace('locale: zh-CN', 'locale: zh-CN\ntranslations: {}'),
        'zh-CN',
        sourceUrl
      )
    ).toThrow(
      expect.objectContaining({
        file: 'README.zh-CN.md',
        code: 'translation',
        line: 3,
      })
    )
  })
})

describe('usage guide downloads', () => {
  const plugin: MarketplacePlugin = {
    key: 'demo',
    name: 'Demo',
    latest: '1.0.0',
    versions: [
      {
        version: '1.0.0',
        path: 'files/plugin',
        readme: {
          path: 'files/readme',
          sourceUrl,
          translations: { 'zh-CN': { path: 'files/readme-zh' } },
        },
      },
    ],
  }
  const indexUrl = 'https://example.com/index.json'
  const load = (language: string, target = plugin) =>
    fetchPluginReadme({
      indexUrl,
      plugin: target,
      version: '1.0.0',
      language,
      signal: new AbortController().signal,
    })

  test('reads the listed translation for the reader and resolves its links against its file', async () => {
    const fetchMock = vi.fn(async () => new Response(chinese))
    vi.stubGlobal('fetch', fetchMock)
    expect(await load('zhCN')).toMatchObject({
      locale: 'zh-CN',
      sourceUrl: 'https://example.com/files/readme-zh',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/files/readme-zh',
      expect.objectContaining({
        credentials: 'omit',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
      })
    )
  })

  test.each([
    ['missing', () => new Response(null, { status: 404 })],
    ['unavailable', () => new Response(null, { status: 500 })],
    ['invalid', () => new Response('<p>中文</p>')],
  ])('an %s translation falls back to English', async (_label, reply) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('readme-zh') ? reply() : new Response(english)
      )
    )
    expect(await load('zhCN')).toMatchObject({ locale: 'en', sourceUrl })
  })

  test('a version without a listed guide downloads nothing', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = await load('en', {
      ...plugin,
      versions: [{ version: '1.0.0', path: 'files/plugin' }],
    })
    expect(result).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('a 404 has no guide and other failures can be retried', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        .mockRejectedValueOnce(new TypeError('offline'))
    )
    expect(await load('en')).toBeNull()
    await expect(load('en')).rejects.toBeInstanceOf(PluginDocumentDownloadError)
  })
})
