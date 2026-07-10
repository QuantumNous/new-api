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
import { test } from 'node:test'

import { api } from '@/lib/api'

import { updateSystemOption } from './api'

test('system option updates use one notification owner', async () => {
  const originalPut = api.put
  let requestConfig: Parameters<typeof api.put>[2]

  try {
    api.put = (async (_url, _request, config) => {
      requestConfig = config
      return {
        data: { success: true, message: '' },
      }
    }) as typeof api.put

    await updateSystemOption({ key: 'SystemName', value: 'Example' })

    assert.equal(requestConfig?.skipBusinessError, true)
    assert.equal(requestConfig?.skipErrorHandler, true)

    api.put = (async () => ({
      data: { success: false, message: 'Update rejected' },
    })) as typeof api.put

    await assert.rejects(
      updateSystemOption({ key: 'SystemName', value: 'Example' }),
      /Update rejected/
    )
  } finally {
    api.put = originalPut
  }
})
