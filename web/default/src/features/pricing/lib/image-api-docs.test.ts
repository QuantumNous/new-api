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

import type { ModelApiProfile } from '../types'
import { buildAsyncImageSample } from './image-api-docs'

const profile: ModelApiProfile = {
  kind: 'image',
  endpoint: '/v1/images/generations',
  async: true,
  poll_endpoint: '/v1/images/generations/{task_id}',
  webhook: true,
  result_delivery: 'oss_url',
  operations: ['generation', 'edit'],
  parameters: [
    { name: 'prompt', type: 'string', required: true },
    {
      name: 'aspect_ratio',
      type: 'enum',
      default: '1:1',
      enum_values: ['1:1', '16:9'],
    },
    {
      name: 'resolution',
      type: 'enum',
      default: '2K',
      enum_values: ['1K', '2K', '4K'],
    },
    {
      name: 'output_format',
      type: 'enum',
      default: 'png',
      enum_values: ['png'],
    },
  ],
}

const context = {
  baseUrl: 'https://api.example.com',
  apiKeyEnv: 'OPWAN_API_KEY',
  modelName: 'gemini-image-model',
  endpointPath: '/v1/images/generations',
  profile,
}

const editProfile: ModelApiProfile = {
  ...profile,
  operations: ['edit'],
  parameters: [
    ...profile.parameters,
    { name: 'image_input', type: 'array', max_items: 16 },
  ],
}

describe('async image API samples', () => {
  test('cURL documents the accepted task and polling contract', () => {
    const sample = buildAsyncImageSample('curl', context)

    assert.match(sample, /HTTP\/1\.1 202 Accepted/)
    assert.match(
      sample,
      /\/v1\/images\/generations\/task_0123456789abcdef0123456789abcdef/
    )
    assert.match(sample, /"object":"image\.generation\.task"/)
    assert.match(sample, /"created_at":1710000000/)
    assert.match(sample, /"aspect_ratio": "1:1"/)
    assert.match(sample, /"resolution": "2K"/)
    assert.match(
      sample,
      /"webhook_url": "https:\/\/example\.com\/webhooks\/images"/
    )
    assert.match(sample, /"webhook_secret": "<YOUR_WEBHOOK_SECRET>"/)
    assert.match(
      sample,
      /IDEMPOTENCY_KEY="image-request-\$\(uuidgen\)"\nTASK_RESPONSE="\$\(/
    )
    assert.match(sample, /Idempotency-Key: \$IDEMPOTENCY_KEY/)
    assert.match(
      sample,
      /python3 -c 'import json, sys; print\(json\.load\(sys\.stdin\)\["task_id"\]\)'/
    )
    assert.match(
      sample,
      /curl -sS "https:\/\/api\.example\.com\/v1\/images\/generations\/\$\{TASK_ID\}"/
    )
    assert.match(sample, /while :; do/)
    assert.match(sample, /completed\|failed\) break ;;/)
    assert.match(sample, /sleep 2/)
    assert.match(sample, /\["result"\]\["data"\]\[0\]\["url"\]/)
    assert.doesNotMatch(sample, /image-request-001/)
    assert.doesNotMatch(sample, /client\.images\.generate/)
  })

  test('JavaScript polls terminal status before reading the OSS URL', () => {
    const sample = buildAsyncImageSample('javascript', context)

    assert.match(sample, /while \(task\.status !== 'completed'/)
    assert.match(sample, /\$\{task\.task_id\}/)
    assert.match(sample, /task\.result\?\.data\?\.\[0\]\?\.url/)
    assert.match(sample, /crypto\.randomUUID\(\)/)
    assert.doesNotMatch(sample, /image-request-001/)
  })

  test('image-to-image samples include a reference image input', () => {
    const sample = buildAsyncImageSample('curl', {
      ...context,
      modelName: 'gpt-image-2-image-to-image',
      profile: editProfile,
    })

    assert.match(sample, /"image_input": \[/)
    assert.match(sample, /https:\/\/example\.com\/reference\.png/)
  })

  test('optional unified dimensions do not replace an upstream auto default', () => {
    const sample = buildAsyncImageSample('curl', {
      ...context,
      modelName: 'gpt-image-2',
      profile: {
        ...profile,
        parameters: [
          { name: 'prompt', type: 'string', required: true },
          {
            name: 'aspect_ratio',
            type: 'enum',
            enum_values: ['auto', '1:1', '16:9'],
          },
          {
            name: 'resolution',
            type: 'enum',
            enum_values: ['1K', '2K', '4K'],
          },
          {
            name: 'size',
            type: 'enum',
            default: 'auto',
            enum_values: ['auto', '1024x1024'],
          },
        ],
      },
    })

    assert.doesNotMatch(sample, /"aspect_ratio":/)
    assert.doesNotMatch(sample, /"resolution":/)
    assert.doesNotMatch(sample, /"size":/)
  })
})
