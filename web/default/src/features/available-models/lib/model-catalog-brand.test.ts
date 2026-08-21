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
import { describe, expect, test } from 'bun:test'
import type { ModelAccessModel } from '../types'
import { resolveModelBrand } from './model-catalog-brand'

function buildModel(
  overrides: Partial<ModelAccessModel> = {}
): ModelAccessModel {
  return {
    id: 'gpt-4o-mini',
    allowlist_match_key: 'gpt-4o-mini',
    vendor: null,
    supported_endpoint_types: ['openai'],
    availability_status: 'available',
    ...overrides,
  }
}

describe('resolveModelBrand', () => {
  // Configured vendor metadata is authoritative — an operator who labelled a
  // channel must not be overridden by a name guess.
  test('prefers configured vendor metadata over the model name', () => {
    const brand = resolveModelBrand(
      buildModel({
        id: 'gpt-4o',
        vendor: { id: 1, name: 'Acme Relay', icon: 'Azure' },
      })
    )

    expect(brand).toEqual({ name: 'Acme Relay', icon: 'Azure' })
  })

  test('keeps a configured vendor name even when it carries no icon', () => {
    const brand = resolveModelBrand(
      buildModel({ id: 'gpt-4o', vendor: { id: 1, name: 'Acme Relay' } })
    )

    expect(brand.name).toBe('Acme Relay')
    expect(brand.icon).toBe('OpenAI')
  })

  // Deployments routinely ship models with no vendor row at all; falling back
  // to the model name is what keeps the card from showing "?" / "Unknown".
  test('infers OpenAI models from the name', () => {
    expect(resolveModelBrand(buildModel({ id: 'gpt-4o-mini' }))).toEqual({
      name: 'OpenAI',
      icon: 'OpenAI',
    })
    expect(resolveModelBrand(buildModel({ id: 'o3-mini' })).name).toBe('OpenAI')
    expect(resolveModelBrand(buildModel({ id: 'gpt-image-2' })).name).toBe(
      'OpenAI'
    )
  })

  test('infers Anthropic, Google and xAI models from the name', () => {
    expect(resolveModelBrand(buildModel({ id: 'claude-opus-4' }))).toEqual({
      name: 'Anthropic',
      icon: 'Claude',
    })
    expect(resolveModelBrand(buildModel({ id: 'gemini-3-pro' }))).toEqual({
      name: 'Google',
      icon: 'Gemini',
    })
    expect(resolveModelBrand(buildModel({ id: 'grok-4' })).name).toBe('xAI')
  })

  test('infers ByteDance models including vendor-prefixed ids', () => {
    expect(
      resolveModelBrand(buildModel({ id: 'bytedance/seedance-2.0' }))
    ).toEqual({ name: 'ByteDance', icon: 'ByteDance' })
    expect(
      resolveModelBrand(buildModel({ id: 'seedance-2.0-fast' })).name
    ).toBe('ByteDance')
    expect(
      resolveModelBrand(buildModel({ id: 'jimeng-video-seedance-2.0-mini' }))
        .name
    ).toBe('ByteDance')
  })

  test('infers the vendor from an explicit path prefix', () => {
    expect(resolveModelBrand(buildModel({ id: 'google/veo-3.1' })).name).toBe(
      'Google'
    )
    expect(
      resolveModelBrand(buildModel({ id: 'anthropic/claude-haiku-4-5' })).name
    ).toBe('Anthropic')
  })

  test('reports no brand for a model it cannot place', () => {
    const brand = resolveModelBrand(buildModel({ id: 'some-internal-model' }))

    expect(brand.name).toBeNull()
    expect(brand.icon).toBeNull()
  })

  test('ignores a blank configured vendor name', () => {
    const brand = resolveModelBrand(
      buildModel({ id: 'claude-opus-4', vendor: { id: 1, name: '   ' } })
    )

    expect(brand.name).toBe('Anthropic')
  })
})
