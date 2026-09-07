/*
Copyright (C) 2023-2026 QuantumNous
*/

import { api } from '@/lib/api'

import type { RoutingPreference, RoutingPreferencesResponse } from './types'

export async function getRoutingPreferences(): Promise<RoutingPreferencesResponse> {
  const response = await api.get('/api/user/self/routing-preferences')
  return response.data
}

export async function updateRoutingPreferences(
  preferences: Record<string, RoutingPreference>
): Promise<RoutingPreferencesResponse> {
  const response = await api.put('/api/user/self/routing-preferences', {
    routing_preferences: preferences,
  })
  return response.data
}
