/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/
import { api } from '@/lib/api'
import type { UserHomeData } from './types'

interface UserHomeEnvelope {
  data: UserHomeData
}

export async function getUserHome(): Promise<UserHomeData> {
  const res = await api.get<UserHomeEnvelope>('/api/v1/marketplace/user-home', {
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data.data
}
