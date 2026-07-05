import { api } from '@/lib/api'

export interface CommissionRule {
  id: number
  rule_code: string
  rule_name: string
  rule_type: 'percentage' | 'fixed' | 'hybrid'
  level1_rate: number
  level2_rate: number
  level3_rate: number
  min_consumption: number
  max_commission: number
  daily_limit: number
  monthly_limit: number
  applicable_models: string
  excluded_models: string
  is_active: boolean
  priority: number
  created_at?: number
  updated_at?: number
}

export interface CommissionRuleForm {
  rule_code: string
  rule_name: string
  rule_type: 'percentage'
  level1_rate: number
  level2_rate: number
  level3_rate: number
  min_consumption: number
  max_commission: number
  daily_limit: number
  monthly_limit: number
  applicable_models: string
  excluded_models: string
  is_active: boolean
  priority: number
}

export async function listCommissionRules(): Promise<{ success?: boolean; message?: string; data?: CommissionRule[] }> {
  const res = await api.get('/api/admin/commission/rules')
  return res.data
}

export async function createCommissionRule(rule: CommissionRuleForm): Promise<{ success?: boolean; message?: string }> {
  const res = await api.post('/api/admin/commission/rules', rule)
  return res.data
}

export async function updateCommissionRule(id: number, rule: Partial<CommissionRuleForm>): Promise<{ success?: boolean; message?: string }> {
  const res = await api.put(`/api/admin/commission/rules/${id}`, rule)
  return res.data
}

export async function deleteCommissionRule(id: number): Promise<{ success?: boolean; message?: string }> {
  const res = await api.delete(`/api/admin/commission/rules/${id}`)
  return res.data
}

export async function toggleCommissionRule(id: number): Promise<{ success?: boolean; message?: string }> {
  const res = await api.patch(`/api/admin/commission/rules/${id}/toggle`)
  return res.data
}
