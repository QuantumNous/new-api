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
import { type badgeVariants } from '@/components/ui/badge'
import { type VariantProps } from 'class-variance-authority'
import type { ComputeNodeStatus } from './types'

type BadgeVariant = VariantProps<typeof badgeVariants>['variant']

/**
 * Status display config. `labelKey` is an i18n key (English source string);
 * render it through `t(config.labelKey)`.
 */
export const COMPUTE_STATUS_CONFIG: Record<
  ComputeNodeStatus,
  { labelKey: string; variant: BadgeVariant }
> = {
  running: { labelKey: 'Running', variant: 'default' },
  provisioning: { labelKey: 'Provisioning', variant: 'secondary' },
  stopped: { labelKey: 'Stopped', variant: 'outline' },
  error: { labelKey: 'Error', variant: 'destructive' },
}

export const COMPUTE_ERROR_MESSAGES = {
  LOAD_FAILED: 'Failed to load compute nodes',
  STOP_FAILED: 'Failed to stop compute node',
} as const

export const COMPUTE_SUCCESS_MESSAGES = {
  STOPPED: 'Compute node stopped',
} as const
