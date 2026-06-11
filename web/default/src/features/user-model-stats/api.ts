import { api } from '@/lib/api'
import type { StatsResponse, ViewType } from './types'

const ENDPOINT_MAP: Record<ViewType, string> = {
  byUser: '/api/data/by-user',
  byModel: '/api/data/by-model',
  byDepartment: '/api/data/by-department',
  byDetail: '/api/data/by-detail',
}

const EXPORT_TYPE_MAP: Record<ViewType, string> = {
  byUser: 'by_user',
  byModel: 'by_model',
  byDepartment: 'by_department',
  byDetail: 'by_detail',
}

export interface FetchStatsParams {
  viewType: ViewType
  startTimestamp: number
  endTimestamp: number
  username?: string
  modelName?: string
  userGroup?: string
  page?: number
  pageSize?: number
}

export async function fetchStats(
  params: FetchStatsParams
): Promise<StatsResponse> {
  const {
    viewType,
    startTimestamp,
    endTimestamp,
    username,
    modelName,
    userGroup,
    page = 1,
    pageSize = 20,
  } = params
  const endpoint = ENDPOINT_MAP[viewType]
  const search = new URLSearchParams()
  search.set('start_timestamp', String(startTimestamp))
  search.set('end_timestamp', String(endTimestamp))
  if (username) search.set('username', username)
  if (modelName) search.set('model_name', modelName)
  if (userGroup) search.set('user_group', userGroup)
  search.set('page', String(page))
  search.set('page_size', String(pageSize))
  const res = await api.get(`${endpoint}?${search.toString()}`)
  return res.data
}

export async function exportStats(
  viewType: ViewType,
  startTimestamp: number,
  endTimestamp: number,
  username?: string,
  modelName?: string,
  userGroup?: string
): Promise<void> {
  const search = new URLSearchParams()
  search.set('start_timestamp', String(startTimestamp))
  search.set('end_timestamp', String(endTimestamp))
  if (username) search.set('username', username)
  if (modelName) search.set('model_name', modelName)
  if (userGroup) search.set('user_group', userGroup)
  search.set('view_type', EXPORT_TYPE_MAP[viewType])
  const res = await api.get(`/api/data/export?${search.toString()}`, {
    responseType: 'blob',
  })
  const blob = new Blob([res.data as BlobPart], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `user-model-stats-${EXPORT_TYPE_MAP[viewType]}-${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}
