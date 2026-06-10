import { apiClient } from '@/lib/api-client'

export interface SecurityGroup {
  id: number
  name: string
  description: string
  status: number
  parent_id: number
  depth: number
  path: string
  sort_order: number
  created_at: number
  updated_at: number
}

export interface SecurityRule {
  id: number
  group_id: number
  group_name?: string
  name: string
  type: number
  content: string
  extra_config: string
  action: number
  priority: number
  risk_score: number
  status: number
  created_at: number
  updated_at: number
}

export interface SecurityPolicy {
  id: number
  user_id: number
  user_name?: string
  group_id: number
  group_name?: string
  scope: number
  default_action: number
  custom_response: string
  whitelist_ips: string
  status: number
  created_at: number
  updated_at: number
}

export interface SecurityHitLog {
  id: number
  request_id: string
  user_id: number
  user_name?: string
  model_name: string
  action: number
  risk_level: number
  risk_score: number
  original_content_hash: string
  processed_content?: string
  match_detail?: string
  ip: string
  created_at: number
}

export interface DashboardData {
  summary: {
    total_detections: number
    total_interceptions: number
    total_alerts: number
    today_detections: number
  }
  top_categories: Array<{ category: string; count: number }>
  top_users: Array<{ user_id: number; user_name: string; count: number }>
  top_models: Array<{ model_name: string; count: number }>
  risk_distribution: { low: number; medium: number; high: number; critical: number }
}

export const securityApi = {
  // Groups
  getGroups: (params?: { page?: number; page_size?: number; status?: number; parent_id?: number }) =>
    apiClient.get('/api/security/groups', { params }).then((r) => r.data),
  createGroup: (data: Partial<SecurityGroup>) => apiClient.post('/api/security/groups', data).then((r) => r.data),
  updateGroup: (id: number, data: Partial<SecurityGroup>) =>
    apiClient.put(`/api/security/groups/${id}`, data).then((r) => r.data),
  deleteGroup: (id: number) => apiClient.delete(`/api/security/groups/${id}`).then((r) => r.data),
  copyGroup: (id: number) => apiClient.post(`/api/security/groups/${id}/copy`).then((r) => r.data),

  // Rules
  getRules: (params?: { page?: number; page_size?: number; group_id?: number; type?: number; status?: number }) =>
    apiClient.get('/api/security/rules', { params }).then((r) => r.data),
  createRule: (data: Partial<SecurityRule>) => apiClient.post('/api/security/rules', data).then((r) => r.data),
  updateRule: (id: number, data: Partial<SecurityRule>) =>
    apiClient.put(`/api/security/rules/${id}`, data).then((r) => r.data),
  deleteRule: (id: number) => apiClient.delete(`/api/security/rules/${id}`).then((r) => r.data),

  // Policies
  getPolicies: (params?: { page?: number; page_size?: number; user_id?: number; status?: number }) =>
    apiClient.get('/api/security/policies', { params }).then((r) => r.data),
  createPolicy: (data: Partial<SecurityPolicy>) => apiClient.post('/api/security/policies', data).then((r) => r.data),
  updatePolicy: (id: number, data: Partial<SecurityPolicy>) =>
    apiClient.put(`/api/security/policies/${id}`, data).then((r) => r.data),
  deletePolicy: (id: number) => apiClient.delete(`/api/security/policies/${id}`).then((r) => r.data),

  // Logs
  getLogs: (params?: { page?: number; page_size?: number; user_id?: number; action?: number; risk_level?: number }) =>
    apiClient.get('/api/security/logs', { params }).then((r) => r.data),

  // Dashboard
  getDashboard: (params?: { start_time?: number; end_time?: number }) =>
    apiClient.get('/api/security/dashboard', { params }).then((r) => r.data),
}
