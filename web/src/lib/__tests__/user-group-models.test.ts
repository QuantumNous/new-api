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
import { describe, expect, it, vi } from 'vitest'

import { api, getUserGroupModels, getUserModels } from '../api'

describe('user model routing API', () => {
  it.each(['codex pro & plus', 'auto'])(
    'passes the exact %s group through query parameters',
    async (group) => {
      const result = { success: true, data: ['gpt-5.6'] }
      const get = vi.spyOn(api, 'get').mockResolvedValue({ data: result })
      expect(await getUserGroupModels(group)).toEqual(result)
      expect(get).toHaveBeenCalledWith('/api/user/models', {
        params: { group },
      })
    }
  )

  it('preserves the unfiltered model-list request for existing consumers', async () => {
    const get = vi
      .spyOn(api, 'get')
      .mockResolvedValue({ data: { success: true, data: [] } })
    await getUserModels()
    expect(get).toHaveBeenCalledWith('/api/user/models')
  })
})
