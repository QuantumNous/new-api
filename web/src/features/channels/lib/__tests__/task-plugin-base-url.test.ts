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
  assessBaseUrlTrust,
  nextTaskPluginBaseUrl,
} from '../task-plugin-base-url'

describe('assessBaseUrlTrust', () => {
  test('returns null for empty or unparsable input', () => {
    expect(assessBaseUrlTrust('')).toBe(null)
    expect(assessBaseUrlTrust('   ')).toBe(null)
    expect(assessBaseUrlTrust('not a url')).toBe(null)
    expect(assessBaseUrlTrust('ftp://files.example.com')).toBe(null)
  })

  test('flags plain http on a public host without flagging the host', () => {
    expect(assessBaseUrlTrust('http://api.example.com/v1')).toStrictEqual({
      plainHttp: true,
      privateHost: false,
    })
  })

  test('flags private, loopback, link-local and single-label hosts', () => {
    for (const url of [
      'http://127.0.0.1:8000',
      'http://localhost:3000',
      'http://10.0.0.5',
      'http://192.168.1.10:8080',
      'http://172.16.0.1',
      'http://169.254.169.254/latest',
      'http://100.64.0.1',
      'http://[::1]:8000',
      'http://[fe80::1]',
      'http://[fd00::1]',
      'http://suno-api:8000',
      'https://nas.local',
      'https://gateway.internal',
    ]) {
      expect(assessBaseUrlTrust(url)?.privateHost, url).toBe(true)
    }
  })

  test('does not flag a public https host', () => {
    expect(assessBaseUrlTrust('https://api.klingai.com')).toStrictEqual({
      plainHttp: false,
      privateHost: false,
    })
    expect(
      assessBaseUrlTrust('https://172.32.0.1')?.privateHost,
      '172.32.x.x is outside the RFC 1918 172.16/12 block'
    ).toBe(false)
  })
})

describe('nextTaskPluginBaseUrl', () => {
  const pluginA = 'http://127.0.0.1:8000'
  const pluginB = 'https://api.vendor-b.example'

  test('fills an empty field with the selected plugin default', () => {
    expect(nextTaskPluginBaseUrl('', undefined, pluginA)).toBe(pluginA)
    expect(nextTaskPluginBaseUrl(undefined, undefined, pluginA)).toBe(pluginA)
  })

  test('replaces the previous plugin default when switching plugins', () => {
    expect(nextTaskPluginBaseUrl(pluginA, pluginA, pluginB)).toBe(pluginB)
    expect(
      nextTaskPluginBaseUrl(`${pluginA}/`, pluginA, pluginB),
      'a trailing slash typed by the browser autocomplete still counts as the default'
    ).toBe(pluginB)
  })

  test('keeps a value the administrator typed by hand', () => {
    expect(
      nextTaskPluginBaseUrl('https://my-proxy.example', pluginA, pluginB)
    ).toBe(null)
    expect(
      nextTaskPluginBaseUrl('https://my-proxy.example', undefined, pluginB)
    ).toBe(null)
  })

  test('changes nothing when the selected plugin declares no default', () => {
    expect(nextTaskPluginBaseUrl('', pluginA, undefined)).toBe(null)
    expect(nextTaskPluginBaseUrl(pluginA, pluginA, '')).toBe(null)
  })

  test('changes nothing when the field already holds the new default', () => {
    expect(nextTaskPluginBaseUrl(`${pluginB}/`, pluginA, pluginB)).toBe(null)
  })
})
