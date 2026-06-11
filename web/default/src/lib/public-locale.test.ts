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
import { describe, test } from 'node:test'
import {
  buildPublicHrefLangLinks,
  getPathLocale,
  isPublicWebsitePath,
  localizePublicPath,
  stripPathLocale,
} from './public-locale'

describe('public locale paths', () => {
  test('detects supported locale prefixes only', () => {
    assert.equal(getPathLocale('/zh/blog/example'), 'zh')
    assert.equal(getPathLocale('/pt'), 'pt')
    assert.equal(getPathLocale('/de/blog/example'), null)
    assert.equal(getPathLocale('/blog/example'), null)
  })

  test('strips locale prefix while preserving root shape', () => {
    assert.equal(stripPathLocale('/zh'), '/')
    assert.equal(stripPathLocale('/zh/'), '/')
    assert.equal(stripPathLocale('/zh/blog/example'), '/blog/example')
    assert.equal(stripPathLocale('/blog/example'), '/blog/example')
  })

  test('localizes public website paths with default language canonical URLs', () => {
    assert.equal(localizePublicPath('/blog/example', 'zh'), '/zh/blog/example')
    assert.equal(
      localizePublicPath('/zh/blog/example', 'ja'),
      '/ja/blog/example'
    )
    assert.equal(localizePublicPath('/zh/blog/example', 'en'), '/blog/example')
    assert.equal(localizePublicPath('/', 'pt'), '/pt')
    assert.equal(localizePublicPath('/zh', 'en'), '/')
  })

  test('does not treat product or admin paths as public website paths', () => {
    assert.equal(isPublicWebsitePath('/pricing'), true)
    assert.equal(isPublicWebsitePath('/zh/blog/example'), true)
    assert.equal(isPublicWebsitePath('/dashboard'), false)
    assert.equal(isPublicWebsitePath('/zh/dashboard'), false)
    assert.equal(isPublicWebsitePath('/system-settings/site'), false)
  })

  test('builds hreflang alternates with en as the unprefixed default URL', () => {
    assert.deepEqual(
      buildPublicHrefLangLinks('https://flatkey.ai', '/zh/blog/example'),
      [
        { hrefLang: 'en', href: 'https://flatkey.ai/blog/example' },
        { hrefLang: 'zh', href: 'https://flatkey.ai/zh/blog/example' },
        { hrefLang: 'es', href: 'https://flatkey.ai/es/blog/example' },
        { hrefLang: 'fr', href: 'https://flatkey.ai/fr/blog/example' },
        { hrefLang: 'pt', href: 'https://flatkey.ai/pt/blog/example' },
        { hrefLang: 'ru', href: 'https://flatkey.ai/ru/blog/example' },
        { hrefLang: 'ja', href: 'https://flatkey.ai/ja/blog/example' },
        { hrefLang: 'vi', href: 'https://flatkey.ai/vi/blog/example' },
        { hrefLang: 'x-default', href: 'https://flatkey.ai/blog/example' },
      ]
    )
  })
})
