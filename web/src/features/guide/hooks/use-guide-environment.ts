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
import { useQueries, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { getPricing } from '@/features/pricing/api'
import { getUserGroupModels, getUserGroups, getUserModels } from '@/lib/api'

import { filterModelsForAudience } from '../lib/runtime'
import type { GuideAudience, GuidePlatform, GuideRuntime } from '../types'
import { useGuideAddress } from '../use-guide-address'

export type GuideEnvironmentState = {
  status: 'loading' | 'ready' | 'empty' | 'error'
  runtime: GuideRuntime
  models: Array<{ value: string; label: string }>
  groups: Array<{ value: string; label: string }>
  setModel: (model: string) => void
  setGroup: (group: string) => void
  retry: () => void
}

type RequestedEnvironment = {
  model?: string
  group?: string
  platform: GuidePlatform
}

type Selection = { model: string; group: string }

export function useGuideEnvironment(
  audience: GuideAudience,
  requested: RequestedEnvironment,
  onSelectionChange: (selection: Selection) => void
): GuideEnvironmentState {
  const address = useGuideAddress()
  const modelsQuery = useQuery({
    queryKey: ['guide', 'user-models'],
    queryFn: getUserModels,
    staleTime: 60_000,
  })
  const groupsQuery = useQuery({
    queryKey: ['guide', 'user-groups'],
    queryFn: getUserGroups,
    staleTime: 60_000,
  })
  const pricingQuery = useQuery({
    queryKey: ['guide', 'pricing'],
    queryFn: getPricing,
    staleTime: 300_000,
  })

  const groupEntries = useMemo(
    () =>
      Object.entries(
        groupsQuery.data?.success ? (groupsQuery.data.data ?? {}) : {}
      ).sort(([left], [right]) => left.localeCompare(right)),
    [groupsQuery.data]
  )
  const groupModelQueries = useQueries({
    queries: groupEntries.map(([group]) => ({
      queryKey: ['guide', 'group-models', group],
      queryFn: () => getUserGroupModels(group),
      enabled: groupsQuery.data?.success === true,
      staleTime: 60_000,
    })),
  })

  const pricingModels = useMemo(
    () =>
      Array.isArray(pricingQuery.data?.data) ? pricingQuery.data.data : [],
    [pricingQuery.data]
  )

  const compatibleModels = useMemo(
    () =>
      filterModelsForAudience(
        modelsQuery.data?.success ? (modelsQuery.data.data ?? []) : [],
        pricingModels,
        audience
      ),
    [audience, modelsQuery.data, pricingModels]
  )
  const selectedModel = compatibleModels.includes(requested.model ?? '')
    ? (requested.model ?? '')
    : (compatibleModels[0] ?? '')

  const compatibleGroups = groupEntries.flatMap(([value, metadata], index) => {
    const query = groupModelQueries[index]
    if (!query?.data?.success || !query.data.data?.includes(selectedModel)) {
      return []
    }
    return [{ value, label: metadata.desc || value }]
  })
  const selectedGroup = compatibleGroups.some(
    (group) => group.value === requested.group
  )
    ? (requested.group ?? '')
    : (compatibleGroups.find((group) => group.value === 'default')?.value ??
      compatibleGroups[0]?.value ??
      '')

  const initialError =
    modelsQuery.isError ||
    groupsQuery.isError ||
    pricingQuery.isError ||
    modelsQuery.data?.success === false ||
    groupsQuery.data?.success === false ||
    pricingQuery.data?.success === false ||
    (pricingQuery.data?.success === true &&
      !Array.isArray(pricingQuery.data.data))
  const groupError = groupModelQueries.some(
    (query) => query.isError || query.data?.success === false
  )
  const loading =
    modelsQuery.isPending ||
    groupsQuery.isPending ||
    pricingQuery.isPending ||
    groupModelQueries.some((query) => query.isPending)

  let status: GuideEnvironmentState['status'] = 'ready'
  if (initialError || groupError) status = 'error'
  else if (loading) status = 'loading'
  else if (!selectedModel || !selectedGroup) status = 'empty'

  const selectedPricing = pricingModels.find(
    (model) => model.model_name === selectedModel
  )
  const verified = status === 'ready'
  const runtime: GuideRuntime = {
    host: address.host,
    baseUrl: address.baseUrl,
    fullUrl: address.fullUrl,
    model: verified ? selectedModel : '<model>',
    group: verified ? selectedGroup : '<group>',
    platform: requested.platform,
    contextLength: verified ? selectedPricing?.context_length : undefined,
    verified,
  }

  const setModel = (model: string) => {
    if (!compatibleModels.includes(model)) return
    const nextGroups = groupEntries.flatMap(([value], index) => {
      const query = groupModelQueries[index]
      return query?.data?.success && query.data.data?.includes(model)
        ? [value]
        : []
    })
    const group = nextGroups.includes(selectedGroup)
      ? selectedGroup
      : (nextGroups.find((value) => value === 'default') ?? nextGroups[0] ?? '')
    onSelectionChange({ model, group })
  }

  const setGroup = (group: string) => {
    if (!compatibleGroups.some((item) => item.value === group)) return
    onSelectionChange({ model: selectedModel, group })
  }

  const retry = () => {
    void Promise.all([
      modelsQuery.refetch(),
      groupsQuery.refetch(),
      pricingQuery.refetch(),
      ...groupModelQueries.map((query) => query.refetch()),
    ])
  }

  return {
    status,
    runtime,
    models: compatibleModels.map((model) => ({ value: model, label: model })),
    groups: compatibleGroups,
    setModel,
    setGroup,
    retry,
  }
}
