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
import { type TFunction } from 'i18next'
import type { StatusVariant } from '@/components/status-badge'

export type ModelAvailabilityStatus =
  | 'available'
  | 'temporary_failure'
  | 'official_unsupported'
  | 'unknown_failure'

export type ModelAvailabilityConfig = {
  label: string
  variant: StatusVariant
  description: string
}

export function getModelAvailabilityConfig(
  t: TFunction
): Record<ModelAvailabilityStatus, ModelAvailabilityConfig> {
  return {
    available: {
      label: t('Available'),
      variant: 'success',
      description: t('Model is currently available'),
    },
    temporary_failure: {
      label: t('Temporary failure'),
      variant: 'warning',
      description: t('Temporary upstream failure'),
    },
    official_unsupported: {
      label: t('Officially unsupported'),
      variant: 'danger',
      description: t('Upstream no longer supports this model'),
    },
    unknown_failure: {
      label: t('Unknown failure'),
      variant: 'neutral',
      description: t('Availability check failed for an unknown reason'),
    },
  }
}
