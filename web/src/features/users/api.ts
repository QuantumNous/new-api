import { api } from '@/lib/api'
import type { User } from './data/schema'

// ============================================================================
// Types
// ============================================================================

export interface GetUsersParams {
  p?: number
  page_size?: number
}

export interface GetUsersResponse {
  success: boolean
  message?: string
  data?: {
    items: User[]
    total: number
    page: number
    page_size: number
  }
}

export interface SearchUsersParams {
  keyword?: string
  group?: string
  p?: number
  page_size?: number
}

export interface UserFormData {
  id?: number
  username: string
  display_name: string
  password?: string
  github_id?: string
  oidc_id?: string
  wechat_id?: string
  telegram_id?: string
  email?: string
  quota?: number
  group?: string
  remark?: string
}

export type ManageUserAction =
  | 'promote'
  | 'demote'
  | 'enable'
  | 'disable'
  | 'delete'

// ============================================================================
// User Management APIs
// ============================================================================

/**
 * Get paginated users list
 */
export async function getUsers(
  params: GetUsersParams = {}
): Promise<GetUsersResponse> {
  const { p = 1, page_size = 10 } = params
  const res = await api.get(`/api/user/?p=${p}&page_size=${page_size}`)
  return res.data
}

/**
 * Search users by keyword or group
 */
export async function searchUsers(
  params: SearchUsersParams
): Promise<GetUsersResponse> {
  const { keyword = '', group = '', p = 1, page_size = 10 } = params
  const res = await api.get(
    `/api/user/search?keyword=${keyword}&group=${group}&p=${p}&page_size=${page_size}`
  )
  return res.data
}

/**
 * Get single user by ID
 */
export async function getUser(
  id: number
): Promise<{ success: boolean; message?: string; data?: User }> {
  const res = await api.get(`/api/user/${id}`)
  return res.data
}

/**
 * Create a new user
 */
export async function createUser(
  data: UserFormData
): Promise<{ success: boolean; message?: string; data?: User }> {
  const res = await api.post('/api/user/', data)
  return res.data
}

/**
 * Update an existing user
 */
export async function updateUser(
  data: UserFormData & { id: number }
): Promise<{ success: boolean; message?: string; data?: User }> {
  const res = await api.put('/api/user/', data)
  return res.data
}

/**
 * Delete a single user (hard delete)
 */
export async function deleteUser(
  id: number
): Promise<{ success: boolean; message?: string }> {
  const res = await api.delete(`/api/user/${id}/`)
  return res.data
}

/**
 * Manage user (promote, demote, enable, disable, delete)
 */
export async function manageUser(
  id: number,
  action: ManageUserAction
): Promise<{ success: boolean; message?: string; data?: Partial<User> }> {
  const res = await api.post('/api/user/manage', { id, action })
  return res.data
}

/**
 * Get all available groups
 */
export async function getGroups(): Promise<{
  success: boolean
  message?: string
  data?: string[]
}> {
  const res = await api.get('/api/group/')
  return res.data
}
