/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your
option) any later version.
*/
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getModelHealthDetail, getModelHealthOverview } from '../api'
import type { ModelHealthWindow } from '../types'

const REFRESH_INTERVAL_MS = 5 * 60 * 1000

export const modelHealthQueryKeys = {
  all: ['model-health'] as const,
  overview: (hours: ModelHealthWindow) =>
    [...modelHealthQueryKeys.all, 'overview', hours] as const,
  detail: (model: string, hours: ModelHealthWindow) =>
    [...modelHealthQueryKeys.all, 'detail', model, hours] as const,
}

export function useModelHealthOverview(hours: ModelHealthWindow) {
  return useQuery({
    queryKey: modelHealthQueryKeys.overview(hours),
    queryFn: () => getModelHealthOverview(hours),
    refetchInterval: REFRESH_INTERVAL_MS,
    staleTime: 60 * 1000,
    retry: false,
  })
}

export function useModelHealthDetail(
  model: string | null,
  hours: ModelHealthWindow
) {
  return useQuery({
    queryKey: modelHealthQueryKeys.detail(model ?? '', hours),
    queryFn: () => getModelHealthDetail(model ?? '', hours),
    enabled: model !== null,
    refetchInterval: REFRESH_INTERVAL_MS,
    staleTime: 60 * 1000,
    retry: false,
  })
}

export function useRefreshModelHealth(): () => Promise<void> {
  const queryClient = useQueryClient()
  return async () => {
    await queryClient.invalidateQueries({ queryKey: modelHealthQueryKeys.all })
  }
}
