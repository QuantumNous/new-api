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
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { fetchApiKeyModels } from '../api'
import type { ApiKey } from '../types'

const MODEL_CATALOG_STALE_TIME_MS = 5 * 60 * 1000

export type ApiKeyModelCatalogScope = Pick<
  ApiKey,
  'id' | 'group' | 'group_candidates' | 'model_limits_enabled' | 'model_limits'
>

type UseApiKeyModelCatalogParams = {
  apiBaseUrl: string
  apiKey: ApiKeyModelCatalogScope | null
  enabled: boolean
  tokenKey: string
}

function normalizeApiBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.trim().replace(/\/+$/, '')
}

export function getApiKeyModelCatalogQueryKey(
  apiBaseUrl: string,
  apiKey: ApiKeyModelCatalogScope | null
) {
  return [
    'api-key-model-catalog',
    normalizeApiBaseUrl(apiBaseUrl),
    apiKey?.id ?? null,
    apiKey?.group ?? '',
    [...(apiKey?.group_candidates ?? [])],
    apiKey?.model_limits_enabled ?? false,
    apiKey?.model_limits ?? '',
  ] as const
}

export function useApiKeyModelCatalog(params: UseApiKeyModelCatalogParams) {
  const queryKey = getApiKeyModelCatalogQueryKey(
    params.apiBaseUrl,
    params.apiKey
  )
  const normalizedApiBaseUrl = queryKey[1]
  const requestEnabled = Boolean(
    params.enabled && params.apiKey && normalizedApiBaseUrl && params.tokenKey
  )
  const query = useQuery({
    queryKey,
    enabled: requestEnabled,
    queryFn: () => fetchApiKeyModels(normalizedApiBaseUrl, params.tokenKey),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: MODEL_CATALOG_STALE_TIME_MS,
    gcTime: MODEL_CATALOG_STALE_TIME_MS,
  })
  const queryIdentity = JSON.stringify(queryKey)
  const previousRequestRef = useRef({ enabled: false, queryIdentity: '' })
  const queryData = query.data
  const queryFetchStatus = query.fetchStatus
  const refetch = query.refetch

  useEffect(() => {
    const previousRequest = previousRequestRef.current
    const shouldRevalidate =
      requestEnabled &&
      queryData !== undefined &&
      queryFetchStatus === 'idle' &&
      (!previousRequest.enabled ||
        previousRequest.queryIdentity !== queryIdentity)

    previousRequestRef.current = { enabled: requestEnabled, queryIdentity }
    if (shouldRevalidate) void refetch()
  }, [queryData, queryFetchStatus, refetch, queryIdentity, requestEnabled])

  return query
}
