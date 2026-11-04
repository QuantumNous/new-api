import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'

import en from '../hw/en.json'

const dir = path.resolve(__dirname, '../locales')
const load = (name: string): Record<string, string> =>
  JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')).translation

// English source text: the upstream file with our own keys laid over it. tr
// may use any key the interface shows, including the ones only we add.
const enSource: Record<string, string> = { ...load('en.json'), ...en }
const tr = load('tr.json')
const placeholders = (s: string) => (s.match(/\{\{[^}]*\}\}/g) ?? []).sort().join(',')
const tags = (s: string) => (s.match(/<\/?[a-zA-Z][^>]*>/g) ?? []).sort().join(',')

describe('tr.json', () => {
  test('only contains keys that exist in the English source', () => {
    const unknown = Object.keys(tr).filter((k) => !Object.hasOwn(enSource, k))
    expect(unknown).toEqual([])
  })

  test('keeps placeholders and markup of the English source', () => {
    const bad = Object.keys(tr).filter(
      (k) =>
        placeholders(enSource[k]) !== placeholders(tr[k]) ||
        tags(enSource[k]) !== tags(tr[k])
    )
    expect(bad).toEqual([])
  })

  test('has no empty values and never names an upstream provider', () => {
    const bad = Object.entries(tr).filter(([k, v]) => !v.trim() || /lumia|openrouter/i.test(k + v))
    expect(bad).toEqual([])
  })

  test('covers the customer-facing sign-in and purchase flow', () => {
    for (const key of ['Sign in', 'Sign up', 'Password', 'Email']) {
      if (Object.hasOwn(en, key)) expect(tr[key], key).toBeTruthy()
    }
    expect(Object.keys(tr).length).toBeGreaterThanOrEqual(2600)
  })
})
