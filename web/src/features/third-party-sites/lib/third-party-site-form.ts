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
import type { TFunction } from 'i18next'
import { z } from 'zod'

import { isValidDiscountText, parseDiscountText } from '@/lib/discount'

import type { ThirdPartySite, ThirdPartySitePayload } from '../types'

export type ThirdPartySiteFormMode = 'create' | 'update'

export interface ThirdPartySiteFormValues {
  name: string
  type: string
  base_url: string
  remote_user_id: string
  api_key: string
  receivable_discount: string
}

export const THIRD_PARTY_SITE_FORM_DEFAULTS: ThirdPartySiteFormValues = {
  name: '',
  type: 'newapi',
  base_url: '',
  remote_user_id: '',
  api_key: '',
  receivable_discount: '1',
}

const NAME_MAX_LENGTH = 128
const BASE_URL_MAX_LENGTH = 1024
const API_KEY_MAX_LENGTH = 4096

// Counted in code points, matching the backend's per-character limit.
const charCount = (value: string) => [...value].length

function isValidBaseUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value) || /[?#]/.test(value)) return false
  try {
    const url = new URL(value)
    return url.hostname !== '' && url.username === '' && url.password === ''
  } catch {
    return false
  }
}

function isValidRemoteUserId(value: string): boolean {
  if (!/^\d+$/.test(value)) return false
  const n = Number(value)
  return Number.isSafeInteger(n) && n > 0
}

// Judged on the text so a long fraction is never rounded into range.

export function getThirdPartySiteFormSchema(
  t: TFunction,
  mode: ThirdPartySiteFormMode
) {
  return z.object({
    name: z.string().superRefine((raw, ctx) => {
      const value = raw.trim()
      if (value === '') {
        ctx.addIssue({ code: 'custom', message: t('Site name is required') })
      } else if (charCount(value) > NAME_MAX_LENGTH) {
        ctx.addIssue({
          code: 'custom',
          message: t('Site name must not exceed 128 characters'),
        })
      }
    }),
    type: z.string().refine((value) => value === 'newapi', {
      message: t('Unsupported site type'),
    }),
    base_url: z.string().superRefine((raw, ctx) => {
      const value = raw.trim()
      if (!isValidBaseUrl(value)) {
        ctx.addIssue({
          code: 'custom',
          message: t(
            'Base URL must be an http or https address without credentials, query or fragment'
          ),
        })
      } else if (charCount(value.replace(/\/+$/, '')) > BASE_URL_MAX_LENGTH) {
        ctx.addIssue({
          code: 'custom',
          message: t('Base URL must not exceed 1024 characters'),
        })
      }
    }),
    remote_user_id: z
      .string()
      .refine((raw) => isValidRemoteUserId(raw.trim()), {
        message: t('Remote user ID must be a positive integer'),
      }),
    api_key: z.string().superRefine((raw, ctx) => {
      const value = raw.trim()
      if (value === '' && mode === 'create') {
        ctx.addIssue({ code: 'custom', message: t('ApiKey is required') })
      } else if (charCount(value) > API_KEY_MAX_LENGTH) {
        ctx.addIssue({
          code: 'custom',
          message: t('ApiKey must not exceed 4096 characters'),
        })
      }
    }),
    receivable_discount: z
      .string()
      .refine((raw) => isValidDiscountText(raw.trim()), {
        message: t(
          'Receivable discount must be greater than 0 and at most 1, with at most 4 decimal places'
        ),
      }),
  })
}

export function toThirdPartySiteFormValues(
  site: ThirdPartySite
): ThirdPartySiteFormValues {
  return {
    name: site.name,
    type: site.type,
    base_url: site.base_url,
    remote_user_id: String(site.remote_user_id),
    api_key: '',
    receivable_discount: String(site.receivable_discount),
  }
}

export function toThirdPartySitePayload(
  values: ThirdPartySiteFormValues,
  mode: ThirdPartySiteFormMode
): ThirdPartySitePayload {
  const payload: ThirdPartySitePayload = {
    name: values.name.trim(),
    type: values.type.trim() as ThirdPartySitePayload['type'],
    base_url: values.base_url.trim(),
    remote_user_id: Number(values.remote_user_id.trim()),
    receivable_discount: parseDiscountText(values.receivable_discount.trim()),
  }
  const apiKey = values.api_key.trim()
  if (mode === 'create' || apiKey !== '') payload.api_key = apiKey
  return payload
}
