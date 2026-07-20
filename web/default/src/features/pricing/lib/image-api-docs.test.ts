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
import {
  buildAsyncImageSample,
  IMAGE_SAMPLE_LANGUAGES,
  STANDARD_SAMPLE_LANGUAGES,
} from './image-api-docs'

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
  test('image samples add Bash without exposing it to standard endpoints', () => {
    assert.deepEqual(IMAGE_SAMPLE_LANGUAGES, [
      'curl',
      'bash',
      'python',
      'typescript',
      'javascript',
    ])
    assert.deepEqual(STANDARD_SAMPLE_LANGUAGES, [
      'curl',
      'python',
      'typescript',
      'javascript',
    ])
  })

  test('cURL stays copy-friendly and shows submit plus poll requests', () => {
    const sample = buildAsyncImageSample('curl', context)

    assert.match(
      sample,
      /curl https:\/\/api\.example\.com\/v1\/images\/generations/
    )
    assert.match(sample, /Idempotency-Key: image-request-<UNIQUE_ID>/)
    assert.match(
      sample,
      /curl "https:\/\/api\.example\.com\/v1\/images\/generations\/<TASK_ID>"/
    )
    assert.match(sample, /HTTP\/1\.1 202 Accepted/)
    assert.doesNotMatch(sample, /set -euo pipefail/)
    assert.doesNotMatch(sample, /python3/)
    assert.doesNotMatch(sample, /read_retry_after/)
    assert.doesNotMatch(sample, /while \[/)
  })

  test('Bash documents the runnable accepted task and polling contract', () => {
    const sample = buildAsyncImageSample('bash', context)

    assert.match(sample, /Requires Bash, curl, and Python 3/)
    assert.match(
      sample,
      /: "\$\{OPWAN_API_KEY:\?Set OPWAN_API_KEY before running\}"/
    )
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
      /IDEMPOTENCY_KEY="image-request-\$\(python3 -c 'import uuid; print\(uuid\.uuid4\(\)\)'\)"/
    )
    assert.match(sample, /Idempotency-Key: \$IDEMPOTENCY_KEY/)
    assert.match(sample, /--max-time "\$REQUEST_TIMEOUT_SECONDS"/)
    assert.match(sample, /readonly POLL_TIMEOUT_SECONDS=900/)
    assert.match(sample, /if \[ "\$HTTP_STATUS" != "202" \]/)
    assert.match(sample, /if \[ "\$HTTP_STATUS" != "200" \]/)
    assert.match(sample, /RETRY_AFTER_SECONDS="\$\(read_retry_after\)"/)
    assert.match(sample, /POLL_DEADLINE=/)
    assert.match(sample, /--max-time "\$POLL_REQUEST_TIMEOUT_SECONDS"/)
    assert.match(
      sample,
      /python3 -c 'import json, sys; print\(json\.load\(sys\.stdin\)\["task_id"\]\)'/
    )
    assert.match(
      sample,
      /"https:\/\/api\.example\.com\/v1\/images\/generations\/\$\{TASK_ID\}"/
    )
    assert.match(sample, /while \[ "\$TASK_STATUS" != "completed" \]/)
    assert.match(sample, /sleep "\$RETRY_AFTER_SECONDS"/)
    assert.match(sample, /\["result"\]\["data"\]\[0\]\["url"\]/)
    assert.doesNotMatch(sample, /"webhook_url"/)
    assert.doesNotMatch(sample, /"webhook_secret"/)
    assert.doesNotMatch(sample, /image-request-001/)
    assert.doesNotMatch(sample, /uuidgen/)
    assert.doesNotMatch(sample, /client\.images\.generate/)
  })

  test('Python validates the async HTTP contract and bounds polling time', () => {
    const sample = buildAsyncImageSample('python', context)

    assert.match(sample, /Requires Python 3\.9\+ and requests 2\.x/)
    assert.match(sample, /api_key = os\.getenv\("OPWAN_API_KEY"\)/)
    assert.match(sample, /Set OPWAN_API_KEY before running/)
    assert.match(sample, /timeout=timeout_seconds/)
    assert.match(sample, /poll_timeout_seconds = 900/)
    assert.match(sample, /require_status\(response, 202, "Submit"\)/)
    assert.match(sample, /require_status\(response, 200, "Poll"\)/)
    assert.match(sample, /response\.headers\.get\("Retry-After", "2"\)/)
    assert.match(sample, /poll_deadline = time\.monotonic\(\)/)
    assert.match(
      sample,
      /timeout_seconds=min\(request_timeout_seconds, remaining\)/
    )
    assert.match(sample, /requests uses per-operation network timeouts/)
    assert.match(sample, /if time\.monotonic\(\) >= poll_deadline:/)
    assert.match(
      sample,
      /Completed task did not include result\.data\[0\]\.url/
    )
    assert.doesNotMatch(sample, /"webhook_url"/)
    assert.doesNotMatch(sample, /"webhook_secret"/)
  })

  test('JavaScript and TypeScript samples are explicit Node or Bun programs', () => {
    for (const language of ['javascript', 'typescript'] as const) {
      const sample = buildAsyncImageSample(language, context)

      assert.match(sample, /Requires Node\.js 18\+ in ESM mode or Bun 1\.0\+/)
      assert.match(sample, /import \{ randomUUID \} from 'node:crypto'/)
      assert.match(sample, /if \(!apiKey\) throw new Error/)
      assert.match(sample, /AbortSignal\.timeout\(timeoutMs\)/)
      assert.match(sample, /const pollTimeoutMs = 900_000/)
      assert.match(sample, /await requireStatus\(response, 202, 'Submit'\)/)
      assert.match(sample, /await requireStatus\(response, 200, 'Poll'\)/)
      assert.match(sample, /headers\.get\('Retry-After'\) \?\? 2/)
      assert.match(
        sample,
        /const pollDeadline = Date\.now\(\) \+ pollTimeoutMs/
      )
      assert.match(sample, /if \(remainingMs <= 0\)/)
      assert.match(sample, /Math\.min\(requestTimeoutMs, remainingMs\)/)
      assert.match(sample, /while \(task\.status !== 'completed'/)
      assert.match(sample, /\$\{taskId\}/)
      assert.match(
        sample,
        /const resultUrl = task\.result\?\.data\?\.\[0\]\?\.url/
      )
      assert.match(
        sample,
        /Completed task did not include result\.data\[0\]\.url/
      )
      assert.match(sample, /console\.log\(resultUrl\)/)
      assert.doesNotMatch(sample, /console\.log\(task\.result/)
      assert.doesNotMatch(sample, /"webhook_url"/)
      assert.doesNotMatch(sample, /"webhook_secret"/)
      assert.doesNotMatch(sample, /image-request-001/)
    }
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
