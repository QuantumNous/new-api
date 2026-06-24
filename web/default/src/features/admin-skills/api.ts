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
import { api } from '@/lib/api'
import type {
  AdminSkill,
  AdminSkillAuditEntry,
  AdminSkillDraftPayload,
  AdminSkillListParams,
  AdminSkillListResponse,
  AdminSkillPatchPayload,
  AdminSkillVersion,
  AdminSkillVersionDetail,
  AdminSkillVersionPayload,
} from './types'

export async function getAdminSkills(
  params: AdminSkillListParams
): Promise<AdminSkillListResponse> {
  const res = await api.get('/api/v1/admin/skills', {
    params,
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

export async function createAdminSkill(
  payload: AdminSkillDraftPayload
): Promise<{ data: AdminSkill }> {
  const res = await api.post('/api/v1/admin/skills', payload, {
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

export async function patchAdminSkill(
  skillId: string,
  payload: AdminSkillPatchPayload
): Promise<{ data: AdminSkill }> {
  const res = await api.patch(`/api/v1/admin/skills/${skillId}`, payload, {
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

export async function createAdminSkillVersion(
  skillId: string,
  payload: AdminSkillVersionPayload
): Promise<{ data: AdminSkillVersion }> {
  const res = await api.post(
    `/api/v1/admin/skills/${skillId}/versions`,
    payload,
    { skipErrorHandler: true } as Record<string, unknown>
  )
  return res.data
}

export async function getAdminSkillVersion(
  skillId: string,
  versionId: string
): Promise<{ data: AdminSkillVersionDetail }> {
  const res = await api.get(
    `/api/v1/admin/skills/${skillId}/versions/${versionId}`,
    { skipErrorHandler: true } as Record<string, unknown>
  )
  return res.data
}

export async function listAdminSkillVersions(
  skillId: string
): Promise<{ data: AdminSkillVersion[] }> {
  const res = await api.get(`/api/v1/admin/skills/${skillId}/versions`, {
    params: { page: 1, limit: 20 },
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

export async function listAdminSkillAuditLog(
  skillId: string
): Promise<{ data: AdminSkillAuditEntry[] }> {
  const res = await api.get(`/api/v1/admin/skills/${skillId}/audit-log`, {
    params: { page: 1, limit: 20 },
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}
