import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { LogOtherData } from '../types'
import { renderAuditContent } from './format'

function interpolate(
  template: string,
  params?: Record<string, unknown>
): string {
  return template.replaceAll(/\{\{(\w+)\}\}/g, (_, key: string) =>
    String(params?.[key] ?? '')
  )
}

describe('atomic model and option audit formatting', () => {
  const cases: Array<[string, Record<string, unknown>, string]> = [
    [
      'option.update_batch',
      { keys: 'ModelPrice, ImageResolutionPrice' },
      'Updated system settings ModelPrice, ImageResolutionPrice',
    ],
    [
      'model.create_with_options',
      {
        model_id: 42,
        model_name: 'image-model',
        option_keys: 'ModelPrice, ImageResolutionPrice',
      },
      'Created model image-model (ID: 42) with settings ModelPrice, ImageResolutionPrice',
    ],
    [
      'model.update_with_options',
      {
        model_id: 42,
        model_name: 'image-model',
        option_keys: 'ImageResolutionPrice',
      },
      'Updated model image-model (ID: 42) with settings ImageResolutionPrice',
    ],
  ]

  for (const [action, params, expected] of cases) {
    test(action, () => {
      const other = { op: { action, params } } as LogOtherData
      assert.equal(renderAuditContent(other, interpolate), expected)
    })
  }
})
