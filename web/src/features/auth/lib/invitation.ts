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
import type { SystemStatus } from '../types'

export const INVITATION_REGISTRATION_METHODS = [
  'password',
  'github',
  'discord',
  'linuxdo',
  'oidc',
  'custom_oauth',
  'wechat',
] as const

export type InvitationRegistrationMethod =
  (typeof INVITATION_REGISTRATION_METHODS)[number]

function isInvitationRegistrationMethod(
  value: unknown
): value is InvitationRegistrationMethod {
  return INVITATION_REGISTRATION_METHODS.includes(
    value as InvitationRegistrationMethod
  )
}

export function getInvitationCodeMethods(
  status: SystemStatus | null
): InvitationRegistrationMethod[] {
  const raw =
    status?.invitation_code_methods ?? status?.data?.invitation_code_methods
  if (!Array.isArray(raw)) return ['linuxdo']
  const methods = [...new Set(raw.filter(isInvitationRegistrationMethod))]
  const required =
    status?.invitation_code_required ??
    status?.data?.invitation_code_required ??
    false
  return required === true && methods.length === 0 ? ['linuxdo'] : methods
}

export function isInvitationCodeRequired(
  status: SystemStatus | null,
  method: InvitationRegistrationMethod
): boolean {
  const required =
    status?.invitation_code_required ??
    status?.data?.invitation_code_required ??
    false
  return required === true && getInvitationCodeMethods(status).includes(method)
}
