import { api } from '@/lib/api'
import type {
  ModelQuotaGroupRule,
  ModelQuotaPlanRule,
  UserModelQuotaUsage,
  GetGroupRulesParams,
  GetPlanRulesParams,
  PaginatedResponse,
  CreateGroupRuleParams,
  CreatePlanRuleParams,
} from './types'

// Group Rules
export async function getGroupRules(
  params: GetGroupRulesParams = {}
): Promise<PaginatedResponse<ModelQuotaGroupRule>> {
  const queryParams = new URLSearchParams()
  if (params.group_name) queryParams.set('group_name', params.group_name)
  queryParams.set('p', String(params.p ?? 1))
  queryParams.set('page_size', String(params.page_size ?? 10))
  const res = await api.get(
    `/api/model-quota/group-rules?${queryParams.toString()}`
  )
  return res.data
}

export async function createGroupRule(data: CreateGroupRuleParams) {
  const res = await api.post('/api/model-quota/group-rules', data)
  return res.data
}

export async function updateGroupRule(
  id: number,
  data: Partial<CreateGroupRuleParams>
) {
  const res = await api.put(`/api/model-quota/group-rules/${id}`, data)
  return res.data
}

export async function deleteGroupRule(id: number) {
  const res = await api.delete(`/api/model-quota/group-rules/${id}`)
  return res.data
}

// Plan Rules
export async function getPlanRules(
  params: GetPlanRulesParams = {}
): Promise<PaginatedResponse<ModelQuotaPlanRule>> {
  const queryParams = new URLSearchParams()
  if (params.plan_id)
    queryParams.set('plan_id', String(params.plan_id))
  queryParams.set('p', String(params.p ?? 1))
  queryParams.set('page_size', String(params.page_size ?? 10))
  const res = await api.get(
    `/api/model-quota/plan-rules?${queryParams.toString()}`
  )
  return res.data
}

export async function createPlanRule(data: CreatePlanRuleParams) {
  const res = await api.post('/api/model-quota/plan-rules', data)
  return res.data
}

export async function updatePlanRule(
  id: number,
  data: Partial<CreatePlanRuleParams>
) {
  const res = await api.put(`/api/model-quota/plan-rules/${id}`, data)
  return res.data
}

export async function deletePlanRule(id: number) {
  const res = await api.delete(`/api/model-quota/plan-rules/${id}`)
  return res.data
}

// User Usage
export async function getUserModelQuotaUsage(userId: number) {
  const res = await api.get(
    `/api/model-quota/user-usage?user_id=${userId}`
  )
  return res.data as {
    success: boolean
    data?: { items: UserModelQuotaUsage[] }
  }
}

export async function resetUserModelQuotaUsage(usageId: number) {
  const res = await api.post(
    `/api/model-quota/user-usage/${usageId}/reset`
  )
  return res.data
}
