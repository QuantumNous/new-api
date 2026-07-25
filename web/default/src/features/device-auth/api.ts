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

import type { DeviceAuthApproveResponse, DeviceAuthInfoResponse } from './types'

export async function getDeviceAuthInfo(
  userCode: string
): Promise<DeviceAuthInfoResponse> {
  // The page renders lookup failures inline, so suppress the global toast.
  const res = await api.get<DeviceAuthInfoResponse>(
    `/api/device/info?user_code=${encodeURIComponent(userCode)}`,
    { skipBusinessError: true }
  )
  return res.data
}

export async function approveDeviceAuth(
  userCode: string,
  approve: boolean
): Promise<DeviceAuthApproveResponse> {
  const res = await api.post<DeviceAuthApproveResponse>('/api/device/approve', {
    user_code: userCode,
    approve,
  })
  return res.data
}
