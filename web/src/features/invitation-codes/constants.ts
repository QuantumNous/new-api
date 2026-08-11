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
import type { StatusVariant } from '@/components/status-badge'

import type { InvitationCode } from './types'

export const INVITATION_CODE_STATUS = {
  ENABLED: 1,
  DISABLED: 2,
  USED: 3,
} as const

export type InvitationCodeState = 'enabled' | 'disabled' | 'used' | 'expired'

export const INVITATION_CODE_STATE_META: Record<
  InvitationCodeState,
  { labelKey: string; variant: StatusVariant }
> = {
  enabled: { labelKey: 'Unused', variant: 'success' },
  disabled: { labelKey: 'Disabled', variant: 'neutral' },
  used: { labelKey: 'Used', variant: 'info' },
  expired: { labelKey: 'Expired', variant: 'warning' },
}

export function getInvitationCodeState(
  invitationCode: InvitationCode
): InvitationCodeState {
  if (invitationCode.state === 'expired') return 'expired'
  if (invitationCode.status === INVITATION_CODE_STATUS.USED) return 'used'
  if (invitationCode.status === INVITATION_CODE_STATUS.DISABLED) {
    return 'disabled'
  }
  if (
    invitationCode.expired_time > 0 &&
    invitationCode.expired_time <= Date.now() / 1000
  ) {
    return 'expired'
  }
  return 'enabled'
}
