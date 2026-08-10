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

import { SLA_INCIDENT_STATUS } from '../constants'
import type { SlaIncident, SlaIncidentFormData } from '../types'

export function getSlaIncidentFormSchema(t: TFunction) {
  return z.object({
    title: z.string().min(1, t('Title is required')),
    description: z.string(),
    status: z
      .number()
      .min(
        SLA_INCIDENT_STATUS.INVESTIGATING,
        t('Status is required')
      )
      .max(SLA_INCIDENT_STATUS.RESOLVED),
    severity: z.string().min(1, t('Severity is required')),
    started_at: z.date().optional(),
    resolved_at: z.date().optional(),
  })
}

export type SlaIncidentFormValues = {
  title: string
  description: string
  status: number
  severity: string
  started_at?: Date
  resolved_at?: Date
}

export const SLA_INCIDENT_FORM_DEFAULT_VALUES: SlaIncidentFormValues = {
  title: '',
  description: '',
  status: SLA_INCIDENT_STATUS.INVESTIGATING,
  severity: 'minor',
  started_at: new Date(),
  resolved_at: undefined,
}

export function transformFormDataToPayload(
  data: SlaIncidentFormValues
): SlaIncidentFormData {
  return {
    title: data.title.trim(),
    description: data.description.trim(),
    status: data.status,
    severity: data.severity,
    started_at: data.started_at
      ? Math.floor(data.started_at.getTime() / 1000)
      : 0,
    resolved_at: data.resolved_at
      ? Math.floor(data.resolved_at.getTime() / 1000)
      : 0,
  }
}

export function transformSlaIncidentToFormDefaults(
  incident: SlaIncident
): SlaIncidentFormValues {
  return {
    title: incident.title,
    description: incident.description,
    status: incident.status,
    severity: incident.severity,
    started_at:
      incident.started_at > 0
        ? new Date(incident.started_at * 1000)
        : undefined,
    resolved_at:
      incident.resolved_at > 0
        ? new Date(incident.resolved_at * 1000)
        : undefined,
  }
}
