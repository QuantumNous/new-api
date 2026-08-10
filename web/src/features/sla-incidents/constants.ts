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
// SLA Incident Status Configuration
// ============================================================================

export const SLA_INCIDENT_STATUS = {
  INVESTIGATING: 1,
  IDENTIFIED: 2,
  MONITORING: 3,
  RESOLVED: 4,
} as const

export const SLA_INCIDENT_STATUS_VALUES = [
  String(SLA_INCIDENT_STATUS.INVESTIGATING),
  String(SLA_INCIDENT_STATUS.IDENTIFIED),
  String(SLA_INCIDENT_STATUS.MONITORING),
  String(SLA_INCIDENT_STATUS.RESOLVED),
] as const

export const SLA_INCIDENT_STATUS_CONFIG: Record<
  number,
  Pick<StatusBadgeProps, 'variant'> & { labelKey: string; value: number }
> = {
  [SLA_INCIDENT_STATUS.INVESTIGATING]: {
    labelKey: 'Investigating',
    variant: 'warning',
    value: SLA_INCIDENT_STATUS.INVESTIGATING,
  },
  [SLA_INCIDENT_STATUS.IDENTIFIED]: {
    labelKey: 'Identified',
    variant: 'danger',
    value: SLA_INCIDENT_STATUS.IDENTIFIED,
  },
  [SLA_INCIDENT_STATUS.MONITORING]: {
    labelKey: 'Monitoring',
    variant: 'info',
    value: SLA_INCIDENT_STATUS.MONITORING,
  },
  [SLA_INCIDENT_STATUS.RESOLVED]: {
    labelKey: 'Resolved',
    variant: 'success',
    value: SLA_INCIDENT_STATUS.RESOLVED,
  },
}

export function getSlaIncidentStatusOptions(t: TFunction) {
  return Object.values(SLA_INCIDENT_STATUS_CONFIG).map((config) => ({
    label: t(config.labelKey),
    value: String(config.value),
  }))
}

// ============================================================================
// SLA Incident Severity Configuration
// ============================================================================

export const SLA_INCIDENT_SEVERITY = {
  MINOR: 'minor',
  MAJOR: 'major',
  CRITICAL: 'critical',
} as const

export const SLA_INCIDENT_SEVERITY_CONFIG: Record<
  string,
  Pick<StatusBadgeProps, 'variant'> & { labelKey: string; value: string }
> = {
  [SLA_INCIDENT_SEVERITY.MINOR]: {
    labelKey: 'Minor',
    variant: 'neutral',
    value: SLA_INCIDENT_SEVERITY.MINOR,
  },
  [SLA_INCIDENT_SEVERITY.MAJOR]: {
    labelKey: 'Major',
    variant: 'warning',
    value: SLA_INCIDENT_SEVERITY.MAJOR,
  },
  [SLA_INCIDENT_SEVERITY.CRITICAL]: {
    labelKey: 'Critical',
    variant: 'danger',
    value: SLA_INCIDENT_SEVERITY.CRITICAL,
  },
}

export function getSlaIncidentSeverityOptions(t: TFunction) {
  return Object.values(SLA_INCIDENT_SEVERITY_CONFIG).map((config) => ({
    label: t(config.labelKey),
    value: config.value,
  }))
}

// ============================================================================
// Error & Success Messages (i18n keys)
// ============================================================================

export const ERROR_MESSAGES = {
  UNEXPECTED: 'An unexpected error occurred',
  LOAD_FAILED: 'Failed to load SLA incidents',
  CREATE_FAILED: 'Failed to create SLA incident',
  UPDATE_FAILED: 'Failed to update SLA incident',
  DELETE_FAILED: 'Failed to delete SLA incident',
  STATUS_INVALID: 'Invalid status',
} as const

export const SUCCESS_MESSAGES = {
  SLA_INCIDENT_CREATED: 'SLA incident created successfully',
  SLA_INCIDENT_UPDATED: 'SLA incident updated successfully',
  SLA_INCIDENT_DELETED: 'SLA incident deleted successfully',
  SLA_INCIDENT_RESOLVED: 'SLA incident resolved successfully',
} as const
