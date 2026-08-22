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

export const MAX_USER_EMAIL_RECIPIENTS = 100

export const userEmailRecipientIdsSchema = z
  .array(z.number().int().positive())
  .max(
    MAX_USER_EMAIL_RECIPIENTS,
    'You can email up to {{count}} users at once.'
  )

export const userEmailFormSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(1, 'Subject is required')
    .max(200, 'Subject must be 200 characters or fewer')
    .refine((value) => !/[\r\n]/.test(value), {
      message: 'Subject must not contain line breaks',
    }),
  content: z
    .string()
    .trim()
    .min(1, 'Message is required')
    .max(10000, 'Message must be 10000 characters or fewer'),
})

export type UserEmailFormData = z.infer<typeof userEmailFormSchema>
