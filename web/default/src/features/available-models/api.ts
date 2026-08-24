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
import { api } from '@/lib/api'
import type { UserModelAccess, UserModelAccessResponse } from './types'

export type UserModelAccessView = 'full' | 'available_models'

export async function getUserModelAccess(
  view: UserModelAccessView = 'full'
): Promise<UserModelAccess> {
  const path =
    view === 'available_models'
      ? '/api/user/model-access?view=available_models'
      : '/api/user/model-access'
  const response = await api.get<UserModelAccessResponse>(path)
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message)
  }
  return response.data.data
}
