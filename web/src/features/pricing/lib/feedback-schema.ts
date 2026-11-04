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

/** Limits match model/hw_pricing_feedback.go; the server enforces them too. */
export const PRICING_FEEDBACK_LIMITS = {
  model: 64,
  message: 2000,
  sourceUrl: 512,
  email: 254,
} as const

export const PRICING_FEEDBACK_KINDS = [
  'price_wrong',
  'model_missing',
  'other',
] as const

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.hostname !== '' &&
      parsed.username === '' &&
      parsed.password === ''
    )
  } catch {
    return false
  }
}

export const pricingFeedbackSchema = z
  .object({
    kind: z.enum(PRICING_FEEDBACK_KINDS),
    model: z.string().trim().max(PRICING_FEEDBACK_LIMITS.model),
    message: z.string().trim().max(PRICING_FEEDBACK_LIMITS.message),
    source_url: z
      .string()
      .trim()
      .max(PRICING_FEEDBACK_LIMITS.sourceUrl)
      .refine((value) => value === '' || isHttpUrl(value), {
        message: 'Enter a link that starts with http:// or https://',
      }),
    email: z
      .string()
      .trim()
      .max(PRICING_FEEDBACK_LIMITS.email)
      .refine(
        (value) =>
          value === '' || /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value),
        { message: 'Enter a valid email address' }
      ),
    website: z.string(),
  })
  .superRefine((values, context) => {
    if (values.kind !== 'other' && values.model === '') {
      context.addIssue({
        code: 'custom',
        path: ['model'],
        message: 'Enter the model name',
      })
    }
    if (values.kind === 'other' && values.message === '') {
      context.addIssue({
        code: 'custom',
        path: ['message'],
        message: 'Describe what is wrong',
      })
    }
  })

export type PricingFeedbackValues = z.infer<typeof pricingFeedbackSchema>

export const PRICING_FEEDBACK_DEFAULTS: PricingFeedbackValues = {
  kind: 'price_wrong',
  model: '',
  message: '',
  source_url: '',
  email: '',
  website: '',
}
