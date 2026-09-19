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

import type { PricingModel } from '../../types'
import { buildSupportedParameters } from '../mock-stats'

function pricingModel(overrides: Partial<PricingModel>): PricingModel {
  return {
    id: 1,
    model_name: 'test-model',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: ['default'],
    ...overrides,
  }
}

const parameterNames = (model: PricingModel) =>
  buildSupportedParameters(model).map((param) => param.name)

describe('buildSupportedParameters', () => {
  it('prefers the declared openai-video endpoint over the name profile', () => {
    // "MiniMax-H3 768P" matches the /mini/ fast-profile pattern, so a
    // name-only lookup reported chat sampling parameters for a video model.
    const model = pricingModel({
      model_name: 'MiniMax-H3 768P',
      supported_endpoint_types: ['openai-video'],
    })

    expect(parameterNames(model)).toEqual([
      'prompt',
      'seconds',
      'size',
      'input_reference',
      'input_video',
      'input_audio',
    ])
  })

  it('keeps chat parameters for chat endpoints', () => {
    const model = pricingModel({
      model_name: 'gpt-5',
      supported_endpoint_types: ['openai'],
    })

    expect(parameterNames(model)).toContain('temperature')
    expect(parameterNames(model)).not.toContain('seconds')
  })

  it('maps image-generation and embeddings endpoints', () => {
    expect(
      parameterNames(
        pricingModel({
          model_name: 'gpt-image-2',
          supported_endpoint_types: ['image-generation'],
        })
      )
    ).toContain('size')

    expect(
      parameterNames(
        pricingModel({
          model_name: 'bge-m3',
          supported_endpoint_types: ['embeddings'],
        })
      )
    ).toContain('input')
  })

  it('falls back to the name profile without declared endpoint types', () => {
    expect(parameterNames(pricingModel({ model_name: 'sora-2' }))).toContain(
      'prompt'
    )
  })

  it('prefers plugin-declared request params over the static video profile', () => {
    const model = pricingModel({
      model_name: 'MiniMax-H3 768P 特价',
      supported_endpoint_types: ['openai-video'],
      request_params: [
        { name: 'prompt', type: 'string', required: true },
        {
          name: 'seconds',
          type: 'integer',
          minimum: 1,
          maximum: 15,
          default: 5,
        },
        {
          name: 'ratio',
          type: 'enum',
          enum: ['16:9', '4:3', '1:1', '3:4', '9:16'],
          default: '9:16',
        },
      ],
    })

    const params = buildSupportedParameters(model)
    expect(params.map((param) => param.name)).toEqual([
      'prompt',
      'seconds',
      'ratio',
    ])
    expect(params[0].required).toBe(true)
    expect(params[1].range).toBe('1 ~ 15')
    expect(params[1].defaultValue).toBe(5)
    expect(params[2].enumValues).toContain('9:16')
    expect(params[2].defaultValue).toBe('9:16')
  })

  it('renders one-sided bounds without a default', () => {
    const model = pricingModel({
      model_name: 'clips-model',
      supported_endpoint_types: ['openai-video'],
      request_params: [
        { name: 'clips', type: 'integer', minimum: 1 },
        { name: 'seed', type: 'integer', maximum: 4294967295 },
      ],
    })

    const params = buildSupportedParameters(model)
    expect(params[0].range).toBe('>= 1')
    expect(params[1].range).toBe('<= 4294967295')
  })
})
