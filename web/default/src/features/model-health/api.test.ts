/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your
option) any later version.
*/
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { api } from '@/lib/api'
import { getModelHealthDetail, getModelHealthOverview } from './api'

afterEach(() => {
  mock.restore()
})

describe('model health API', () => {
  test('requests the selected overview window', async () => {
    const get = spyOn(api, 'get').mockResolvedValue({
      data: { success: true, data: { models: [] } },
    } as never)

    await getModelHealthOverview(168)

    expect(get).toHaveBeenCalledWith('/api/data/model_health', {
      params: { hours: 168 },
    })
  })

  test('requests detail for the selected model and window', async () => {
    const get = spyOn(api, 'get').mockResolvedValue({
      data: { success: true, data: { series: [], groups: [] } },
    } as never)

    await getModelHealthDetail('vendor/model name', 720)

    expect(get).toHaveBeenCalledWith('/api/data/model_health/detail', {
      params: { model: 'vendor/model name', hours: 720 },
    })
  })

  test('rejects a business-error overview envelope', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: { success: false, message: 'denied' },
    } as never)

    await expect(getModelHealthOverview(24)).rejects.toThrow('denied')
  })

  test('rejects a detail envelope that omits data', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: { success: true },
    } as never)

    await expect(getModelHealthDetail('model-a', 24)).rejects.toThrow()
  })
})
