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
*/
import { api } from '@/lib/api'

import type {
  ApiResponse,
  ListTeamsParams,
  Team,
  TeamBilling,
  TeamFormData,
  TeamMember,
  TeamMemberFormData,
  TeamProject,
  TeamProjectFormData,
  TeamUpdateData,
} from './types'

// ============================================================================
// Team Management
// ============================================================================

export async function listTeams(
  params: ListTeamsParams = {}
): Promise<ApiResponse<{ items: Team[]; total: number }>> {
  const queryParams = new URLSearchParams()
  queryParams.set('page', String(params.page ?? 1))
  queryParams.set('page_size', String(params.page_size ?? 10))
  if (params.keyword) queryParams.set('keyword', params.keyword)
  const res = await api.get(`/api/admin/teams?${queryParams.toString()}`)
  return res.data
}

export async function getTeam(id: number): Promise<ApiResponse<Team>> {
  const res = await api.get(`/api/admin/teams/${id}`)
  return res.data
}

export async function createTeam(
  data: TeamFormData
): Promise<ApiResponse<{ id: number }>> {
  const res = await api.post('/api/admin/teams', data)
  return res.data
}

// Update team (the name is immutable server-side)
export async function updateTeam(
  id: number,
  data: TeamUpdateData
): Promise<ApiResponse<{ ok: boolean }>> {
  const res = await api.put(`/api/admin/teams/${id}`, data)
  return res.data
}

export async function deleteTeam(
  id: number
): Promise<ApiResponse<{ ok: boolean }>> {
  const res = await api.delete(`/api/admin/teams/${id}`)
  return res.data
}

// ============================================================================
// Team Members
// ============================================================================

export async function listTeamMembers(
  id: number,
  params: { page?: number; page_size?: number } = {}
): Promise<ApiResponse<{ items: TeamMember[]; total: number }>> {
  const queryParams = new URLSearchParams()
  queryParams.set('page', String(params.page ?? 1))
  queryParams.set('page_size', String(params.page_size ?? 10))
  const res = await api.get(
    `/api/admin/teams/${id}/members?${queryParams.toString()}`
  )
  return res.data
}

export async function addTeamMember(
  id: number,
  data: TeamMemberFormData
): Promise<ApiResponse<{ id: number }>> {
  const res = await api.post(`/api/admin/teams/${id}/members`, data)
  return res.data
}

export async function removeTeamMember(
  id: number,
  userId: number
): Promise<ApiResponse<{ ok: boolean }>> {
  const res = await api.delete(`/api/admin/teams/${id}/members/${userId}`)
  return res.data
}

// ============================================================================
// Team Projects
// ============================================================================

// Returns all projects for a team (no pagination server-side)
export async function listTeamProjects(
  id: number
): Promise<ApiResponse<{ items: TeamProject[] }>> {
  const res = await api.get(`/api/admin/teams/${id}/projects`)
  return res.data
}

export async function addTeamProject(
  id: number,
  data: TeamProjectFormData
): Promise<ApiResponse<{ id: number }>> {
  const res = await api.post(`/api/admin/teams/${id}/projects`, data)
  return res.data
}

export async function removeTeamProject(
  id: number,
  projectId: number
): Promise<ApiResponse<{ ok: boolean }>> {
  const res = await api.delete(`/api/admin/teams/${id}/projects/${projectId}`)
  return res.data
}

// ============================================================================
// Team Billing (read-only)
// ============================================================================

export async function getTeamBilling(
  id: number
): Promise<ApiResponse<TeamBilling>> {
  const res = await api.get(`/api/admin/teams/${id}/billing`)
  return res.data
}
