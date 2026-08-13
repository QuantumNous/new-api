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

import type { PricingModel } from '../../types'
import { buildSupportedParameters } from '../mock-stats.ts'
import { resolveModelApiEndpoints } from '../model-api-endpoints.ts'

function pricingModel(
  modelName: string,
  endpointTypes?: string[]
): PricingModel {
  return {
    id: 1,
    model_name: modelName,
    quota_type: 1,
    model_ratio: 0,
    completion_ratio: 0,
    enable_groups: ['default'],
    supported_endpoint_types: endpointTypes,
  }
}

describe('resolveModelApiEndpoints', () => {
  test('uses the public OpenAI route when pricing returns an empty path', () => {
    const endpoints = resolveModelApiEndpoints(
      pricingModel('gpt-5.6-sol', ['openai']),
      { openai: { path: '', method: 'POST' } }
    )

    assert.deepEqual(endpoints, [
      {
        type: 'openai',
        path: '/v1/chat/completions',
        method: 'POST',
      },
    ])
  })

  test('provides an OpenAI request example when endpoint types are absent', () => {
    const endpoints = resolveModelApiEndpoints(
      pricingModel('gemini-3.5-flash'),
      {}
    )

    assert.deepEqual(endpoints, [
      {
        type: 'openai',
        path: '/v1/chat/completions',
        method: 'POST',
      },
    ])
  })

  test('keeps an explicit endpoint path and replaces its model placeholder', () => {
    const endpoints = resolveModelApiEndpoints(
      pricingModel('nexa-custom-model', ['gemini']),
      {
        gemini: {
          path: '/custom/models/{model}:generateContent',
          method: 'post',
        },
      }
    )

    assert.deepEqual(endpoints, [
      {
        type: 'gemini',
        path: '/custom/models/nexa-custom-model:generateContent',
        method: 'POST',
      },
    ])
  })

  test('uses the async image route for an image endpoint with an empty path', () => {
    const endpoints = resolveModelApiEndpoints(
      pricingModel('nano-banana-2', ['async-image-generation']),
      { 'async-image-generation': { path: '', method: 'POST' } }
    )

    assert.deepEqual(endpoints, [
      {
        type: 'async-image-generation',
        path: '/v1/async/images/generations',
        method: 'POST',
      },
    ])
  })

  test('shows the async request first when an image model exposes chat too', () => {
    const model = pricingModel('gemini-3-pro-image-preview', [
      'openai',
      'async-image-generation',
    ])
    model.tags = 'image,gemini'

    const endpoints = resolveModelApiEndpoints(model, {})

    assert.deepEqual(
      endpoints.map((endpoint) => endpoint.type),
      ['async-image-generation', 'openai']
    )
  })

  test('infers the async image route when image endpoint metadata is absent', () => {
    const model = pricingModel('gpt-image-2-vip')
    model.tags = 'image'

    const endpoints = resolveModelApiEndpoints(model, {})

    assert.deepEqual(endpoints, [
      {
        type: 'async-image-generation',
        path: '/v1/async/images/generations',
        method: 'POST',
      },
    ])
  })

  test('uses upstream image metadata for the supported resolution parameter', () => {
    const model = pricingModel('nano-banana-2', ['async-image-generation'])
    model.image_generation = {
      resolutions: ['1K', '2K', '4K'],
      resolution_parameter: 'quality',
      sizes: ['1:1', '16:9', '9:16', '4:3', '3:4'],
      default_resolution: '1K',
      default_size: '1:1',
      resolution_price_multipliers: { '1K': 1, '2K': 1, '4K': 1 },
    }

    const parameters = buildSupportedParameters(model)
    const quality = parameters.find((parameter) => parameter.name === 'quality')

    assert.deepEqual(quality, {
      name: 'quality',
      type: 'enum',
      defaultValue: '1K',
      range: '1K / 2K / 4K',
      descriptionKey: 'Output resolution tier',
    })
  })

  test('shows gpt-image-vip resolution tiers through explicit size presets', () => {
    const model = pricingModel('gpt-image-2-vip', ['async-image-generation'])
    model.image_generation = {
      resolutions: ['1K', '2K', '4K'],
      resolution_parameter: 'size',
      sizes: ['1280x1280', '2048x2048', '2880x2880'],
      default_resolution: '2K',
      default_size: '2048x2048',
      resolution_price_multipliers: { '1K': 1, '2K': 1, '4K': 2 },
    }

    const parameters = buildSupportedParameters(model)
    const size = parameters.find((parameter) => parameter.name === 'size')
    const quality = parameters.find((parameter) => parameter.name === 'quality')

    assert.deepEqual(size, {
      name: 'size',
      type: 'string',
      defaultValue: '2048x2048',
      range: '1K / 2K / 4K',
      descriptionKey: 'Output image size',
    })
    assert.equal(quality, undefined)
  })

  test('uses backend image metadata even when a legacy profile classifies the model as chat', () => {
    const model = pricingModel('nano-banana-2', ['async-image-generation'])
    model.image_generation = {
      resolutions: ['1K', '2K', '4K'],
      resolution_parameter: 'quality',
      sizes: ['1:1', '16:9'],
      default_resolution: '1K',
      default_size: '1:1',
      resolution_price_multipliers: { '1K': 1, '2K': 1, '4K': 1 },
    }

    assert.deepEqual(
      buildSupportedParameters(model).map((parameter) => parameter.name),
      ['prompt', 'size', 'quality', 'n', 'response_format']
    )
  })
})
