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
import { describe, expect, it } from 'vitest'

import { DEFAULT_CONFIG } from '../../../constants'
import type { GroupOption, ModelOption } from '../../../types'
import {
  getGroupFallback,
  getModelFallback,
  getUnavailableAlternative,
  labelUnavailableModels,
} from '../playground-option-utils'

const options = (...values: string[]): ModelOption[] =>
  values.map((value) => ({ label: value, value }))

const groups = (...values: string[]): GroupOption[] =>
  values.map((value) => ({ label: value, value, ratio: 1 }))

describe('getGroupFallback', () => {
  it('keeps a group that is still offered', () => {
    expect(getGroupFallback(groups('free', 'paid'), 'free', 'paid')).toBeNull()
  })

  it('moves a hidden group to the account group, not the first one', () => {
    expect(getGroupFallback(groups('free', 'paid'), 'default', 'paid')).toBe(
      'paid'
    )
  })

  it('falls back to default when the account group is not offered', () => {
    expect(getGroupFallback(groups('free', 'default'), 'vip', 'paid')).toBe(
      'default'
    )
  })

  it('falls back to the first group without account or default group', () => {
    expect(getGroupFallback(groups('free', 'paid'), 'default', 'default')).toBe(
      'free'
    )
    expect(getGroupFallback(groups('free', 'paid'), 'default')).toBe('free')
    expect(getGroupFallback([], 'default', 'paid')).toBeNull()
  })
})

describe('getModelFallback', () => {
  it('starts on the best-value cheap model', () => {
    expect(DEFAULT_CONFIG.model).toBe('claude-haiku-5-5')
  })

  it('keeps a model that is still offered', () => {
    const models = options('claude-opus-5-5', 'claude-haiku-5-5')
    expect(getModelFallback(models, 'claude-opus-5-5')).toBeNull()
  })

  it('moves a saved older model to its newer successor', () => {
    const models = options(
      'claude-haiku-4-5',
      'claude-haiku-5-5',
      'claude-sonnet-5',
      'claude-sonnet-5-5'
    )
    expect(getModelFallback(models, 'claude-haiku-4-5')).toBe(
      'claude-haiku-5-5'
    )
    expect(getModelFallback(models, 'claude-sonnet-5')).toBe(
      'claude-sonnet-5-5'
    )
  })

  it('keeps an older model when its successor is not offered', () => {
    expect(
      getModelFallback(options('claude-haiku-4-5'), 'claude-haiku-4-5')
    ).toBeNull()
  })

  it('falls back to the best-value model, not the first in the list', () => {
    const models = options(
      'gpt-6-astra',
      'claude-sonnet-5-5',
      'claude-haiku-5-5'
    )
    expect(getModelFallback(models, 'gpt-4o')).toBe('claude-haiku-5-5')
    expect(
      getModelFallback(options('gpt-6-astra', 'claude-sonnet-5-5'), 'gpt-4o')
    ).toBe('claude-sonnet-5-5')
  })

  it('uses the first model when no preferred model is offered', () => {
    expect(
      getModelFallback(options('claude-haiku-5-5', 'gpt-6-astra'), 'gpt-4o')
    ).toBe('claude-haiku-5-5')
    expect(getModelFallback([], 'gpt-4o')).toBeNull()
  })
})

describe('labelUnavailableModels', () => {
  it('appends the suffix to a temporarily unavailable model only', () => {
    const labelled = labelUnavailableModels(
      options('claude-opus-5-5', 'gpt-6-astra'),
      { 'claude-opus-5-5': 'gpt-6-astra' },
      'temporarily unavailable'
    )
    expect(labelled.map((model) => model.label)).toEqual([
      'claude-opus-5-5 (temporarily unavailable)',
      'gpt-6-astra',
    ])
    expect(labelled.map((model) => model.value)).toEqual([
      'claude-opus-5-5',
      'gpt-6-astra',
    ])
  })

  it('returns the same list when nothing is unavailable', () => {
    const models = options('claude-opus-5-5')
    expect(labelUnavailableModels(models, {}, 'x')).toBe(models)
  })
})

describe('getUnavailableAlternative', () => {
  const models = options(
    'claude-fable-5-1',
    'claude-opus-5-5',
    'gpt-6',
    'gpt-6-astra'
  )

  it('names the model the unavailable error suggests, in any language', () => {
    expect(
      getUnavailableAlternative(
        'model_unavailable',
        'claude-fable-5-1 is temporarily unavailable. Try claude-opus-5-5 or try again shortly.',
        models
      )
    ).toBe('claude-opus-5-5')
    expect(
      getUnavailableAlternative(
        'model_unavailable',
        'claude-opus-5-5 şu anda geçici olarak kullanılamıyor. gpt-6-astra modelini deneyin veya biraz sonra tekrar deneyin.',
        models
      )
    ).toBe('gpt-6-astra')
  })

  it('never reads a shorter model name inside a longer offered one', () => {
    const list = options('gpt-6', 'gpt-6-astra')
    // Only the failed model is mentioned, so there is nothing to suggest; a
    // plain substring search would read gpt-6 out of gpt-6-astra and offer it.
    expect(
      getUnavailableAlternative(
        'model_unavailable',
        'gpt-6-astra is temporarily unavailable. Try gpt-6-astra or try again shortly.',
        list
      )
    ).toBeNull()
  })

  it('returns null without a suggestion, another error code or an unreachable model', () => {
    expect(
      getUnavailableAlternative(
        'model_unavailable',
        'This model is temporarily unavailable. Please try again shortly.',
        models
      )
    ).toBeNull()
    expect(
      getUnavailableAlternative(
        'service_busy',
        'claude-fable-5-1 is temporarily unavailable. Try claude-opus-5-5 or try again shortly.',
        models
      )
    ).toBeNull()
    expect(
      getUnavailableAlternative(
        'model_unavailable',
        'claude-fable-5-1 is temporarily unavailable. Try claude-sonnet-5-5 or try again shortly.',
        models
      )
    ).toBeNull()
  })

  it('never offers the failed model behind the stored error title', () => {
    expect(
      getUnavailableAlternative(
        'model_unavailable',
        'API request error: claude-fable-5-1 is temporarily unavailable. Try claude-sonnet-5-5 or try again shortly.',
        models
      )
    ).toBeNull()
    expect(
      getUnavailableAlternative(
        'model_unavailable',
        'API request error: claude-fable-5-1 is temporarily unavailable. Try claude-opus-5-5 or try again shortly.',
        models
      )
    ).toBe('claude-opus-5-5')
  })
})
