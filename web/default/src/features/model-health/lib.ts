/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your
option) any later version.
*/
import type {
  ModelHealthFilter,
  ModelHealthModel,
  ModelHealthSortKey,
  ModelHealthState,
  ModelHealthWindow,
  SortDirection,
} from './types'

const HEALTH_PRIORITY: Record<ModelHealthState, number> = {
  degraded: 0,
  watch: 1,
  insufficient: 2,
  healthy: 3,
}

export function formatInteger(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
    value
  )
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatMetric(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: digits,
  }).format(value)
}

export function formatTimestamp(value: number | null): string {
  if (value === null) return '—'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value * 1000))
}

export function windowLabelKey(hours: ModelHealthWindow): string {
  if (hours === 24) return '24h'
  if (hours === 168) return '7d'
  return '30d'
}

export function healthLabelKey(state: ModelHealthState): string {
  if (state === 'healthy') return 'Healthy'
  if (state === 'watch') return 'Watch'
  if (state === 'degraded') return 'Degraded'
  return 'Insufficient data'
}

export function getModelHealthViewState(options: {
  hasData: boolean
  isError: boolean
  isLoading: boolean
}): 'loading' | 'error' | 'data' | 'data-with-refetch-error' {
  if (options.hasData)
    return options.isError ? 'data-with-refetch-error' : 'data'
  return options.isLoading ? 'loading' : 'error'
}

export function filterAndSortModels(options: {
  models: ModelHealthModel[]
  search: string
  filter: ModelHealthFilter
  sortKey: ModelHealthSortKey
  direction: SortDirection
}): ModelHealthModel[] {
  const needle = options.search.trim().toLocaleLowerCase()
  const rows = options.models.filter((model) => {
    const matchesSearch = model.model_name.toLocaleLowerCase().includes(needle)
    const matchesState =
      options.filter === 'all' || model.health === options.filter
    return matchesSearch && matchesState
  })

  return [...rows].sort((left, right) => {
    const result = compareModelValues(
      left,
      right,
      options.sortKey,
      options.direction
    )
    if (result !== 0) return result
    if (left.request_count !== right.request_count) {
      return right.request_count - left.request_count
    }
    return left.model_name.localeCompare(right.model_name)
  })
}

function compareModelValues(
  left: ModelHealthModel,
  right: ModelHealthModel,
  key: ModelHealthSortKey,
  direction: SortDirection
): number {
  let result: number
  if (key === 'health') {
    result = HEALTH_PRIORITY[left.health] - HEALTH_PRIORITY[right.health]
    return direction === 'desc' ? -result : result
  }
  if (key === 'model_name') {
    result = left.model_name.localeCompare(right.model_name)
    return direction === 'desc' ? -result : result
  }
  return compareNullableNumber(left[key], right[key], direction)
}

function compareNullableNumber(
  left: number | null,
  right: number | null,
  direction: SortDirection
): number {
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1
  const result = left - right
  return direction === 'desc' ? -result : result
}
