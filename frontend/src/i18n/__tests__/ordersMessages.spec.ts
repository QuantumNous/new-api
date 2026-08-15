import { describe, expect, it } from 'vitest'

import enConsole from '@/i18n/locales/en/console'
import zhConsole from '@/i18n/locales/zh-CN/console'

/**
 * The orders surface is the first console page whose labels are built from the
 * key factories in `constants/adminOrders.ts` rather than written inline, so a
 * missing entry surfaces as a raw `orders.status.completed` string in the UI
 * instead of a build error. These checks close that gap: the locales must carry
 * an identical key set, and every `orders.*` key the source references must
 * resolve in both.
 *
 * Sources are read through `import.meta.glob(..., '?raw')` rather than node:fs
 * so the spec stays inside the app's type scope (tsconfig.app.json exposes only
 * vite/client, not @types/node).
 */

type Messages = Record<string, unknown>

const sources = import.meta.glob<string>(
  [
    '@/views/console/*.vue',
    '@/components/console/orders/*.vue',
    '@/composables/*.ts',
    '@/constants/*.ts',
  ],
  { query: '?raw', import: 'default', eager: true }
)

function flatten(value: Messages, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, entry]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return entry !== null && typeof entry === 'object' && !Array.isArray(entry)
      ? flatten(entry as Messages, path)
      : [path]
  })
}

function resolve(messages: Messages, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Messages)[part] : undefined,
      messages
    )
}

const zhOrders = (zhConsole as Messages).orders as Messages
const enOrders = (enConsole as Messages).orders as Messages

describe('orders locale parity', () => {
  it('carries the same key set in both locales', () => {
    expect(flatten(zhOrders).sort()).toEqual(flatten(enOrders).sort())
  })

  it('leaves no key with an empty translation', () => {
    for (const messages of [zhOrders, enOrders]) {
      for (const path of flatten(messages)) {
        expect(String(resolve(messages, path)).trim(), path).not.toBe('')
      }
    }
  })
})

describe('orders message references', () => {
  it('resolves every literal orders.* key used in the source', () => {
    const referenced = new Set<string>()
    for (const source of Object.values(sources)) {
      for (const match of source.matchAll(
        /['"`](orders\.[a-zA-Z0-9_.]+)['"`]/g
      )) {
        referenced.add(match[1]!)
      }
    }

    // Guards the guard: were the scan to stop matching, the assertion below
    // would pass vacuously and protect nothing.
    expect(referenced.size).toBeGreaterThan(20)

    const missing = [...referenced].filter(
      (key) =>
        resolve(zhConsole as Messages, key) === undefined ||
        resolve(enConsole as Messages, key) === undefined
    )
    expect(missing).toEqual([])
  })
})
