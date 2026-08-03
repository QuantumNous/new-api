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

import type { StatusBadgeProps } from '@/components/status-badge'

// ============================================================================
// Team Member Role Configuration
// ============================================================================

export const TEAM_MEMBER_ROLE = {
  ADMIN: 'admin',
  MEMBER: 'member',
} as const

export const TEAM_MEMBER_ROLE_CONFIG: Record<
  string,
  Pick<StatusBadgeProps, 'variant'> & { labelKey: string; value: string }
> = {
  [TEAM_MEMBER_ROLE.ADMIN]: {
    labelKey: 'Admin',
    variant: 'info',
    value: TEAM_MEMBER_ROLE.ADMIN,
  },
  [TEAM_MEMBER_ROLE.MEMBER]: {
    labelKey: 'Member',
    variant: 'neutral',
    value: TEAM_MEMBER_ROLE.MEMBER,
  },
}

export function getTeamMemberRoleOptions(t: TFunction) {
  return Object.values(TEAM_MEMBER_ROLE_CONFIG).map((config) => ({
    label: t(config.labelKey),
    value: config.value,
  }))
}

// ============================================================================
// Validation Constants
// ============================================================================

export const TEAM_NAME_MAX_LENGTH = 64
export const TEAM_DESCRIPTION_MAX_LENGTH = 255
export const TEAM_PROJECT_NAME_MAX_LENGTH = 64

// ============================================================================
// Error & Success Messages (i18n keys)
// ============================================================================

export const ERROR_MESSAGES = {
  LOAD_FAILED: 'Failed to load teams',
  LOAD_MEMBERS_FAILED: 'Failed to load team members',
  LOAD_PROJECTS_FAILED: 'Failed to load team projects',
  LOAD_BILLING_FAILED: 'Failed to load billing summary',
} as const

export const SUCCESS_MESSAGES = {
  TEAM_CREATED: 'Team created successfully',
  TEAM_UPDATED: 'Team updated successfully',
  TEAM_DELETED: 'Team deleted successfully',
  MEMBER_ADDED: 'Team member added successfully',
  MEMBER_REMOVED: 'Team member removed successfully',
  PROJECT_ADDED: 'Team project added successfully',
  PROJECT_REMOVED: 'Team project removed successfully',
} as const
