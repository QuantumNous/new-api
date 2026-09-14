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

import { LOG_TYPE_ENUM } from '../../constants'
import { usageLogSchema } from '../../data/schema'
import {
  collapseRequestOutcomes,
  isFailedRequest,
  getRecordedUnitPrices,
} from '../request-details'

describe('recorded request unit prices', () => {
  it('derives cache-read and cache-write unit prices only from recorded ratios', () => {
    expect(
      getRecordedUnitPrices({
        model_ratio: 2,
        completion_ratio: 3,
        cache_ratio: 0.1,
        cache_creation_ratio: 1.25,
        cache_creation_ratio_5m: 1.25,
        cache_creation_ratio_1h: 2,
      })
    ).toMatchObject({
      input: 4,
      output: 12,
      cacheRead: 0.4,
      cacheWrite: 5,
      cacheWrite5m: 5,
      cacheWrite1h: 8,
    })
  })

  it('preserves free cache prices and does not invent missing or invalid cache rates', () => {
    expect(
      getRecordedUnitPrices({
        model_ratio: 2,
        cache_ratio: 0,
        cache_creation_ratio: 0,
      })
    ).toMatchObject({ cacheRead: 0, cacheWrite: 0 })
    expect(getRecordedUnitPrices({ model_ratio: 2 })).toMatchObject({
      cacheRead: null,
      cacheWrite: null,
      cacheWrite5m: null,
      cacheWrite1h: null,
    })
    expect(
      getRecordedUnitPrices({
        model_ratio: 2,
        cache_ratio: -1,
        cache_creation_ratio: Infinity,
        cache_creation_ratio_1h: Number.MAX_VALUE,
      })
    ).toMatchObject({ cacheRead: null, cacheWrite: null, cacheWrite1h: null })
  })
  it('uses historical model rates and preserves explicit free input or output', () => {
    expect(
      getRecordedUnitPrices({ model_ratio: 2, completion_ratio: 3 })
    ).toMatchObject({ mode: 'tokens', input: 4, output: 12 })
    expect(
      getRecordedUnitPrices({ model_ratio: 0, completion_ratio: 3 })
    ).toMatchObject({ input: 0, output: 0 })
    expect(
      getRecordedUnitPrices({ model_ratio: 2, completion_ratio: 0 })
    ).toMatchObject({ input: 4, output: 0 })
  })

  it('does not invent missing prices or present overflow as a price', () => {
    expect(getRecordedUnitPrices(null)).toMatchObject({
      input: null,
      output: null,
    })
    expect(getRecordedUnitPrices({ model_ratio: 2 })).toMatchObject({
      input: 4,
      output: null,
    })
    expect(
      getRecordedUnitPrices({
        model_ratio: Number.MAX_VALUE,
        completion_ratio: 2,
      })
    ).toMatchObject({ input: null, output: null })
  })

  it('distinguishes per-request, dynamic and penalty billing from token prices', () => {
    expect(
      getRecordedUnitPrices({ model_price: 0.03, model_ratio: 2 })
    ).toEqual({ mode: 'request', input: null, output: null, perRequest: 0.03 })
    expect(
      getRecordedUnitPrices({ billing_mode: 'tiered_expr', model_ratio: 2 })
    ).toMatchObject({ mode: 'dynamic', input: null, output: null })
    expect(
      getRecordedUnitPrices({ violation_fee: true, model_ratio: 2 })
    ).toMatchObject({ mode: 'fee', input: null, output: null })
  })
})

describe('request outcomes', () => {
  it.each([
    [{ violation_fee: true, status_code: 400 }, true],
    [{ violation_fee_code: 'penalty' }, true],
    [{ violation_fee_marker: 'penalty' }, true],
    [{}, false],
  ])(
    'classifies consume metadata %j with failed=%s while preserving charges',
    (other, failed) => {
      const log = usageLogSchema.parse({
        id: 1,
        user_id: 42,
        created_at: 1000,
        content: '',
        type: LOG_TYPE_ENUM.CONSUME,
        quota: 20,
        other: JSON.stringify(other),
      })
      expect(isFailedRequest(log)).toBe(failed)
      expect(log.quota).toBe(20)
    }
  )
})

describe('retried request outcomes', () => {
  const log = (overrides: Record<string, unknown>) =>
    usageLogSchema.parse({
      id: 1,
      user_id: 42,
      created_at: 1000,
      content: '',
      ...overrides,
    })

  it('drops the retry error row once the request settled with a charge', () => {
    const logs = [
      log({
        id: 3,
        type: LOG_TYPE_ENUM.CONSUME,
        request_id: 'retry',
        quota: 30,
      }),
      log({ id: 2, type: LOG_TYPE_ENUM.ERROR, request_id: 'retry' }),
      log({ id: 1, type: LOG_TYPE_ENUM.ERROR, request_id: 'solo' }),
    ]

    expect(collapseRequestOutcomes(logs).map((item) => item.id)).toEqual([3, 1])
  })

  it('keeps the settled charge when the retry error was persisted later', () => {
    const logs = [
      log({ id: 3, type: LOG_TYPE_ENUM.ERROR, request_id: 'retry' }),
      log({
        id: 2,
        type: LOG_TYPE_ENUM.CONSUME,
        request_id: 'retry',
        quota: 30,
      }),
    ]

    expect(collapseRequestOutcomes(logs).map((item) => item.id)).toEqual([2])
  })

  it('keeps only the latest consume row of a repeated settlement', () => {
    const logs = [
      log({
        id: 2,
        type: LOG_TYPE_ENUM.CONSUME,
        request_id: 'retry',
        quota: 30,
      }),
      log({
        id: 1,
        type: LOG_TYPE_ENUM.CONSUME,
        request_id: 'retry',
        quota: 10,
      }),
    ]

    expect(collapseRequestOutcomes(logs).map((item) => item.id)).toEqual([2])
  })

  it('keeps standalone failures and rows recorded without a request id', () => {
    const logs = [
      log({ id: 3, type: LOG_TYPE_ENUM.ERROR, request_id: '' }),
      log({ id: 2, type: LOG_TYPE_ENUM.ERROR, request_id: 'solo' }),
    ]

    expect(collapseRequestOutcomes(logs).map((item) => item.id)).toEqual([3, 2])
  })
})
