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
import { z } from 'zod'

import { permissionMatrixToScopes } from '@/lib/admin-permissions'

// The server rejects expiry times earlier than one hour from now.
const MIN_LIFETIME_MS = 60 * 60 * 1000

export const ACCESS_TOKEN_EXPIRY_DAYS = {
  '30d': 30,
  '90d': 90,
  '180d': 180,
  '1y': 365,
} as const

export const ACCESS_TOKEN_EXPIRY_OPTIONS = [
  { value: '30d', labelKey: '30 days' },
  { value: '90d', labelKey: '90 days' },
  { value: '180d', labelKey: '180 days' },
  { value: '1y', labelKey: '1 year' },
  { value: 'custom', labelKey: 'Custom' },
  { value: 'never', labelKey: 'Never expires' },
] as const

export type AccessTokenExpiryPreset =
  (typeof ACCESS_TOKEN_EXPIRY_OPTIONS)[number]['value']

const accessTokenNameSchema = z
  .string()
  .trim()
  .min(1, 'Please enter a name')
  // The server counts characters, not UTF-16 code units.
  .refine((name) => [...name].length <= 64, {
    message: 'Name must be 64 characters or fewer',
  })

const accessTokenPermissionsSchema = z.record(
  z.string(),
  z.record(z.string(), z.boolean())
)

export const accessTokenFormSchema = z
  .object({
    name: accessTokenNameSchema,
    expiry: z.enum(['30d', '90d', '180d', '1y', 'custom', 'never']),
    customExpiresAt: z.date().optional(),
    permissions: accessTokenPermissionsSchema,
  })
  .superRefine((values, ctx) => {
    if (
      values.expiry === 'custom' &&
      (!values.customExpiresAt ||
        values.customExpiresAt.getTime() < Date.now() + MIN_LIFETIME_MS)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['customExpiresAt'],
        message: 'Choose a time at least one hour from now',
      })
    }
    if (permissionMatrixToScopes(values.permissions).length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['permissions'],
        message: 'Select at least one permission',
      })
    }
  })

export type AccessTokenFormValues = z.infer<typeof accessTokenFormSchema>

// The edit form has no expiry. An empty grant is only rejected once the
// permissions change, so a token whose permissions can no longer be granted
// can still be renamed.
export const accessTokenEditFormSchema = z.object({
  name: accessTokenNameSchema,
  permissions: accessTokenPermissionsSchema,
})

export type AccessTokenEditFormValues = z.infer<
  typeof accessTokenEditFormSchema
>

export const defaultAccessTokenFormValues: AccessTokenFormValues = {
  name: '',
  expiry: '30d',
  customExpiresAt: undefined,
  permissions: {},
}

// resolveAccessTokenExpiry converts the chosen preset to the Unix-seconds
// expiry the API expects; 0 means the token never expires.
export function resolveAccessTokenExpiry(
  values: Pick<AccessTokenFormValues, 'expiry' | 'customExpiresAt'>,
  nowMs: number
): number {
  if (values.expiry === 'never') return 0
  if (values.expiry === 'custom') {
    return Math.floor((values.customExpiresAt?.getTime() ?? 0) / 1000)
  }
  const days = ACCESS_TOKEN_EXPIRY_DAYS[values.expiry]
  return Math.floor(nowMs / 1000) + days * 24 * 60 * 60
}
