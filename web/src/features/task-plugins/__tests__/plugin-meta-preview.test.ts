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
import { describe, expect, test, vi } from 'vitest'

import { parseMarketplaceIndex } from '../lib/marketplace'
import {
  parsePluginMetaPreview,
  resolvePluginMetaPreview,
} from '../lib/plugin-meta-preview'
import type { MarketplacePlugin } from '../types'

const inchoMeta = `export const meta = {
  apiVersion: 1, key: "incho", name: "Incho", version: "1.0.1",
  models: ["incho_music"],
  baseUrl: "https://open.yinchaoyongxian.com",
  protocols: [{name: "openai_responses", supports: ["stream", "sync", "background"]}],
  routes: [
    {method: "POST", path: "/incho/submit/:action", type: "submit", decode: "decodeSubmit"},
    {method: "GET", path: "/incho/fetch/:task_id", type: "query"},
  ],
};`

const plugin: MarketplacePlugin = {
  key: 'incho',
  name: 'Incho',
  latest: '1.0.1',
  versions: [
    { version: '1.0.1', path: 'new.js' },
    { version: '1.0.0', path: 'old.js', baseUrl: 'https://old.example.com' },
  ],
  models: ['latest-model'],
  protocols: ['openai_video'],
  channelTypes: [61],
}

test('reads the selected Incho models, protocols and both native routes without requiring runtime hooks', () => {
  const preview = parsePluginMetaPreview(inchoMeta)
  expect(preview.status).toBe('parsed')
  expect(preview.fields.models).toEqual({
    state: 'value',
    origin: 'source',
    value: ['incho_music'],
  })
  expect(preview.fields.protocols).toEqual({
    state: 'value',
    origin: 'source',
    value: [
      { name: 'openai_responses', supports: ['stream', 'sync', 'background'] },
    ],
  })
  expect(preview.fields.routes).toEqual({
    state: 'value',
    origin: 'source',
    value: [
      { method: 'POST', path: '/incho/submit/:action', type: 'submit' },
      { method: 'GET', path: '/incho/fetch/:task_id', type: 'query' },
    ],
  })
  expect(preview.fields.allowedHosts).toEqual({
    state: 'missing',
    origin: 'source',
  })
  expect(preview.fields.auth).toEqual({ state: 'missing', origin: 'source' })
})

test('supports comments, trailing commas, quoted keys and JavaScript string escapes', () => {
  const preview =
    parsePluginMetaPreview(String.raw`export const /* declaration */ meta /* name */ = /* value */ {
    "models": [/* model */ '\x69ncho_\u006dusic', 'line\nquote\'slash\\',],
    baseUrl: "https://example.com/\u{1F3B5}",
    auth: {type: 'api_key'}, channelTypes: [+61, 0x18],
  };`)
  expect(preview.status).toBe('parsed')
  expect(preview.fields.models).toEqual({
    state: 'value',
    origin: 'source',
    value: ['incho_music', "line\nquote'slash\\"],
  })
  expect(preview.fields.baseUrl).toEqual({
    state: 'value',
    origin: 'source',
    value: 'https://example.com/🎵',
  })
  expect(preview.fields.auth).toEqual({
    state: 'value',
    origin: 'source',
    value: 'api_key',
  })
  expect(preview.fields.channelTypes).toEqual({
    state: 'value',
    origin: 'source',
    value: [61, 24],
  })
})

describe('unreadable declarations never produce partial lists or execute code', () => {
  test.each([
    'export const meta = { ...external, models: ["m"] };',
    'export const meta = { models: ["m"], [key]: [] };',
    'export const meta = makeMeta();',
    'export const meta = { models: ["m"] }; meta.models.push("changed");',
    'export const meta = { models: ["m"] }; mutate(meta);',
    'export const meta = { models: ["m"] ',
    'const meta = { models: ["m"] }; export {meta};',
  ])('keeps every field unknown for %s', (source) => {
    const preview = parsePluginMetaPreview(source)
    expect(preview.status).toBe('unavailable')
    expect(
      Object.values(preview.fields).every((field) => field.state === 'unknown')
    ).toBe(true)
  })

  test.each([
    'routes: [{method: "GET", path: "/a", type: "query"}, other]',
    'routes: [{method: "GET", path: "/a", type: "query", ...overrides}]',
    'routes: [{method: "GET", path: "/a", type: "unsupported"}]',
    'routes: [], routes: []',
    'get routes() { throw new Error("must not execute") }',
    'routes: [,]',
  ])('marks only the affected field unknown for %s', (declaration) => {
    const preview = parsePluginMetaPreview(
      `export const meta = {models: ['m'], ${declaration}};`
    )
    expect(preview.status).toBe('partial')
    expect(preview.fields.routes).toEqual({ state: 'unknown' })
    expect(preview.fields.models).toEqual({
      state: 'value',
      origin: 'source',
      value: ['m'],
    })
  })

  test('does not invoke a metadata expression or top-level plugin statement', () => {
    const probe = vi.fn()
    vi.stubGlobal('previewProbe', probe)
    try {
      const preview = parsePluginMetaPreview(
        'previewProbe(); export const meta = {models: ["m"], routes: previewProbe()};'
      )
      expect(preview.status).toBe('partial')
      expect(probe).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

test('keeps source omissions and empty arrays distinct and does not overwrite them with index values', () => {
  const source = parsePluginMetaPreview(
    'export const meta = {models: [], allowedHosts: []};'
  )
  const resolved = resolvePluginMetaPreview(plugin, plugin.versions[0], source)
  expect(resolved.models).toEqual({
    state: 'value',
    origin: 'source',
    value: [],
  })
  expect(resolved.allowedHosts).toEqual({
    state: 'value',
    origin: 'source',
    value: [],
  })
  expect(resolved.protocols).toEqual({ state: 'missing', origin: 'source' })
})

test('only uses plugin-level index hints for the latest version and marks fallback provenance', () => {
  const source = parsePluginMetaPreview('export const meta = buildMeta();')
  const latest = resolvePluginMetaPreview(plugin, plugin.versions[0], source)
  expect(latest.protocols).toEqual({
    state: 'value',
    origin: 'index',
    value: ['openai_video'],
  })
  const older = resolvePluginMetaPreview(plugin, plugin.versions[1], source)
  expect(older.models.state).toBe('unknown')
  expect(older.protocols.state).toBe('unknown')
  expect(older.channelTypes.state).toBe('unknown')
  expect(older.baseUrl).toEqual({
    state: 'value',
    origin: 'index',
    value: 'https://old.example.com',
  })
})

test('preserves valid protocol declarations and empty model lists from the marketplace index', () => {
  const index = parseMarketplaceIndex({
    indexVersion: 1,
    name: 'test',
    plugins: [plugin, { ...plugin, key: 'empty', models: [], protocols: [] }],
  })
  expect(
    index.plugins.find((entry) => entry.key === 'incho')?.protocols
  ).toEqual(['openai_video'])
  expect(index.plugins.find((entry) => entry.key === 'empty')?.models).toEqual(
    []
  )
  expect(
    index.plugins.find((entry) => entry.key === 'empty')?.protocols
  ).toEqual([])
})
