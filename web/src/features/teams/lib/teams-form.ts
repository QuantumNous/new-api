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
import type { TFunction } from 'i18next'
import { z } from 'zod'

import {
  TEAM_DESCRIPTION_MAX_LENGTH,
  TEAM_MEMBER_ROLE,
  TEAM_NAME_MAX_LENGTH,
  TEAM_PROJECT_NAME_MAX_LENGTH,
} from '../constants'
import type {
  Team,
  TeamFormData,
  TeamMemberFormData,
  TeamProjectFormData,
  TeamUpdateData,
} from '../types'

// ============================================================================
// Team Form Schema
// ============================================================================

export function getTeamFormSchema(t: TFunction) {
  return z.object({
    name: z
      .string()
      .min(1, t('Name is required'))
      .max(TEAM_NAME_MAX_LENGTH, t('Name is too long')),
    description: z
      .string()
      .max(TEAM_DESCRIPTION_MAX_LENGTH, t('Description is too long')),
    owner_id: z.number().min(1, t('Owner User ID is required')),
  })
}

export type TeamFormValues = {
  name: string
  description: string
  owner_id: number
}

export const TEAM_FORM_DEFAULT_VALUES: TeamFormValues = {
  name: '',
  description: '',
  owner_id: 0,
}

export function transformFormDataToPayload(data: TeamFormValues): TeamFormData {
  return {
    name: data.name.trim(),
    description: data.description.trim(),
    owner_id: data.owner_id,
  }
}

export function transformFormDataToUpdatePayload(
  data: TeamFormValues
): TeamUpdateData {
  return {
    description: data.description.trim(),
    owner_id: data.owner_id,
  }
}

export function transformTeamToFormDefaults(team: Team): TeamFormValues {
  return {
    name: team.name,
    description: team.description,
    owner_id: team.owner_id,
  }
}

// ============================================================================
// Team Member Form Schema
// ============================================================================

export function getTeamMemberFormSchema(t: TFunction) {
  return z.object({
    user_id: z.number().min(1, t('User ID is required')),
    role: z.string().min(1, t('Role is required')),
  })
}

export type TeamMemberFormValues = {
  user_id: number
  role: string
}

export const TEAM_MEMBER_FORM_DEFAULT_VALUES: TeamMemberFormValues = {
  user_id: 0,
  role: TEAM_MEMBER_ROLE.MEMBER,
}

export function transformMemberFormDataToPayload(
  data: TeamMemberFormValues
): TeamMemberFormData {
  return {
    user_id: data.user_id,
    role: data.role,
  }
}

// ============================================================================
// Team Project Form Schema
// ============================================================================

export function getTeamProjectFormSchema(t: TFunction) {
  return z.object({
    name: z
      .string()
      .min(1, t('Name is required'))
      .max(TEAM_PROJECT_NAME_MAX_LENGTH, t('Name is too long')),
    description: z
      .string()
      .max(TEAM_DESCRIPTION_MAX_LENGTH, t('Description is too long')),
  })
}

export type TeamProjectFormValues = {
  name: string
  description: string
}

export const TEAM_PROJECT_FORM_DEFAULT_VALUES: TeamProjectFormValues = {
  name: '',
  description: '',
}

export function transformProjectFormDataToPayload(
  data: TeamProjectFormValues
): TeamProjectFormData {
  return {
    name: data.name.trim(),
    description: data.description.trim(),
  }
}
