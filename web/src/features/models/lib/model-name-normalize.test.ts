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
  findModelInCatalog,
  modelNameMatches,
  normalizeModelName,
} from './model-name-normalize'

describe('normalizeModelName', () => {
  test('empty and whitespace collapse to empty string', () => {
    assert.equal(normalizeModelName(''), '')
    assert.equal(normalizeModelName('   '), '')
  })

  test('is idempotent so repeated normalization is safe', () => {
    const cases = [
      'doubao-seedream-5-0-pro-260628',
      'doubao-seed-1-6-vision-250815',
      'Doubao-Seedream-5.0-pro',
      'gpt-4o-mini',
      'text-embedding-3-large',
    ]
    for (const c of cases) {
      const once = normalizeModelName(c)
      const twice = normalizeModelName(once)
      assert.equal(once, twice, `idempotency failed for ${c}`)
    }
  })

  // ---------------------------------------------------------------------------
  // Golden cases straight from the user's Volcano console examples. These
  // pin down the exact behavior that unblocks pricing lookup for real
  // Doubao model names.
  // ---------------------------------------------------------------------------

  test('doubao-seedream-5-0-pro-260628 becomes 5.0 (keeps date tail)', () => {
    assert.equal(
      normalizeModelName('doubao-seedream-5-0-pro-260628'),
      'doubao-seedream-5.0-pro-260628',
    )
  })

  test('doubao-seed-1-6-vision-250815 becomes 1.6 (keeps date tail)', () => {
    assert.equal(
      normalizeModelName('doubao-seed-1-6-vision-250815'),
      'doubao-seed-1.6-vision-250815',
    )
  })

  test('doubao-seedance-2-0-fast-260128 becomes 2.0', () => {
    assert.equal(
      normalizeModelName('doubao-seedance-2-0-fast-260128'),
      'doubao-seedance-2.0-fast-260128',
    )
  })

  test('capital letters get lowercased for comparison', () => {
    assert.equal(
      normalizeModelName('Doubao-Seedream-5.0-pro'),
      'doubao-seedream-5.0-pro',
    )
  })

  test('already-dotted input stays put', () => {
    assert.equal(
      normalizeModelName('claude-3.5-sonnet'),
      'claude-3.5-sonnet',
    )
  })

  // ---------------------------------------------------------------------------
  // Regressions we care about — patterns that MUST NOT be munged.
  // ---------------------------------------------------------------------------

  test('model size markers like -7b are preserved', () => {
    // `qwen2-7b`: the `2-7` is NOT a version, it's a model-family digit
    // followed by a size. Converting to `qwen2.7b` would be wrong.
    // Because `7b` has a trailing `b`, our regex (limited to digits) never
    // considers `-2-7` a version pattern.
    assert.equal(normalizeModelName('qwen2-7b-instruct'), 'qwen2-7b-instruct')
  })

  test('gpt-4o is not munged into a fake version', () => {
    assert.equal(normalizeModelName('gpt-4o'), 'gpt-4o')
    assert.equal(normalizeModelName('gpt-4o-mini'), 'gpt-4o-mini')
  })

  test('trailing -N-M with no suffix also gets dotted', () => {
    // Rare case where the model name ends in an unversioned tail, e.g.
    // a shorthand family key `kimi-1-6`.
    assert.equal(normalizeModelName('kimi-1-6'), 'kimi-1.6')
  })
})

// -----------------------------------------------------------------------------
// findModelInCatalog
// -----------------------------------------------------------------------------

describe('findModelInCatalog', () => {
  test('exact key match takes priority over fuzzy match', () => {
    const catalog = {
      'doubao-seedream-5-0-pro-260628': { source: 'exact' },
      'Doubao-Seedream-5.0-pro': { source: 'canonical' },
    }
    const hit = findModelInCatalog(
      'doubao-seedream-5-0-pro-260628',
      catalog,
    )
    assert.ok(hit)
    assert.equal(hit.value.source, 'exact')
  })

  test('routing-form input finds canonical-form catalogue key', () => {
    const catalog = {
      'Doubao-Seedream-5.0-pro': { price: 0.04 },
      'Doubao-Seed-1.6-vision': { price: 0.02 },
    }
    const hit = findModelInCatalog(
      'doubao-seedream-5-0-pro-260628',
      catalog,
    )
    assert.ok(hit)
    assert.equal(hit.key, 'Doubao-Seedream-5.0-pro')
    assert.equal(hit.value.price, 0.04)
  })

  test('longest overlap wins when multiple keys are compatible', () => {
    const catalog = {
      'doubao-seed-1.6': { tier: 'family' },
      'doubao-seed-1.6-vision': { tier: 'specific' },
    }
    const hit = findModelInCatalog(
      'doubao-seed-1-6-vision-250815',
      catalog,
    )
    assert.ok(hit)
    assert.equal(hit.value.tier, 'specific')
  })

  test('nothing matches returns null', () => {
    const catalog = { 'gpt-4o': { price: 5 } }
    const hit = findModelInCatalog(
      'doubao-seedance-2-0-260128',
      catalog,
    )
    assert.equal(hit, null)
  })

  test('empty input returns null', () => {
    const catalog = { 'gpt-4o': { price: 5 } }
    assert.equal(findModelInCatalog('', catalog), null)
  })
})

// -----------------------------------------------------------------------------
// modelNameMatches
// -----------------------------------------------------------------------------

describe('modelNameMatches', () => {
  test('trivially identical strings match', () => {
    assert.equal(modelNameMatches('foo', 'foo'), true)
  })

  test('routing name matches family-level catalogue name', () => {
    assert.equal(
      modelNameMatches(
        'doubao-seed-1-6-vision-250815',
        'doubao-seed-1.6-vision',
      ),
      true,
    )
    assert.equal(
      modelNameMatches(
        'doubao-seedance-2-0-fast-260128',
        'doubao-seedance-2.0-fast',
      ),
      true,
    )
  })

  test('unrelated names do not match', () => {
    assert.equal(modelNameMatches('gpt-4o', 'claude-3.5-sonnet'), false)
    assert.equal(
      modelNameMatches('doubao-seedance-2-0', 'doubao-seedream-5.0'),
      false,
    )
  })

  test('empty input never matches', () => {
    assert.equal(modelNameMatches('', 'foo'), false)
    assert.equal(modelNameMatches('foo', ''), false)
  })
})
