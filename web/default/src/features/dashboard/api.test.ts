/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your
option) any later version.
*/
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { api } from '@/lib/api'
import { getUserQuotaDates } from './api'

afterEach(() => {
  mock.restore()
})

describe('dashboard API', () => {
  test('uses the canonical trailing-slash route for admin quota data', async () => {
    const get = spyOn(api, 'get').mockResolvedValue({
      data: { success: true, data: [] },
    } as never)
    const params = {
      start_timestamp: 100,
      end_timestamp: 200,
      default_time: 'day',
    }

    await getUserQuotaDates(params, true)

    expect(get).toHaveBeenCalledWith('/api/data/', { params })
  })

  test('keeps the self quota route unchanged', async () => {
    const get = spyOn(api, 'get').mockResolvedValue({
      data: { success: true, data: [] },
    } as never)
    const params = {
      start_timestamp: 100,
      end_timestamp: 200,
    }

    await getUserQuotaDates(params)

    expect(get).toHaveBeenCalledWith('/api/data/self', { params })
  })
})
