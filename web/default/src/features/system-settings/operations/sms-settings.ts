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
import type { UpdateOptionRequest } from '../types'

export type SmsSettingsFormValues = {
  SMSEnabled: boolean
  SMSProvider: string
  SMSBaoEndpoint: string
  SMSBaoQueryEndpoint: string
  SMSBaoUsername: string
  SMSBaoCredential: string
  SMSBaoCredentialMode: string
  SMSBaoProductID: string
  SMSCodeValidMinutes: number
  SMSCodeCooldownSeconds: number
  SMSSignature: string
  SMSSignatureReviewStatus: 'pending' | 'approved' | 'rejected'
  SMSProductName: string
  SMSTemplate: string
  SMSRateLimitEnabled: boolean
  SMSRateLimitWindowSeconds: number
  SMSRateLimitPhoneCount: number
  SMSRateLimitIPCount: number
  SMSRateLimitAccountCount: number
  SMSRateLimitSceneCount: number
}

export type SmsTestFormValues = {
  phone: string
  scene: string
  code: string
}

export type SmsStatusResult = {
  provider?: string
  provider_code?: string
  sent_count?: number
  remaining_count?: number
}

export type SmsTestResult = {
  phone_masked?: string
  provider?: string
  provider_code?: string
  template_scene?: string
}

export const defaultSmsTestValues: SmsTestFormValues = {
  phone: '',
  scene: 'register',
  code: '',
}

export const smsSceneOptions = [
  { value: 'register', labelKey: 'Register' },
  { value: 'login', labelKey: 'Login' },
  { value: 'bind_phone', labelKey: 'Bind phone' },
  { value: 'change_phone', labelKey: 'Change phone' },
  { value: 'reset_password', labelKey: 'Reset password' },
]

export function buildSmsSettingsUpdates(
  values: Partial<SmsSettingsFormValues>,
  initial: Partial<SmsSettingsFormValues>
): UpdateOptionRequest[] {
  return Object.entries(values).reduce<UpdateOptionRequest[]>(
    (updates, [key, value]) => {
      if (key === 'SMSBaoCredential') {
        if (typeof value !== 'string' || value.trim() === '') {
          return updates
        }
        updates.push({ key, value: value.trim() })
        return updates
      }

      const initialValue = initial[key as keyof SmsSettingsFormValues]
      if (value === initialValue) {
        return updates
      }

      if (typeof value === 'string') {
        updates.push({ key, value: value.trim() })
        return updates
      }

      if (typeof value === 'number' || typeof value === 'boolean') {
        updates.push({ key, value })
      }

      return updates
    },
    []
  )
}
