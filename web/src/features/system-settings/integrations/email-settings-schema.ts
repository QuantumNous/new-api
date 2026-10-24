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
import * as z from 'zod'

export const createEmailSchema = (t: (key: string) => string) =>
  z
    .object({
      EmailProvider: z.enum(['smtp', 'resend']),
      ResendApiKey: z.string(),
      ResendKeyConfigured: z.boolean(),
      ResendFrom: z.string(),
      ResendSenderName: z.string(),
      SMTPServer: z.string(),
      SMTPPort: z.string(),
      SMTPAccount: z.string(),
      SMTPFrom: z.string(),
      SMTPToken: z.string(),
      SMTPSSLEnabled: z.boolean(),
      SMTPStartTLSEnabled: z.boolean(),
      SMTPInsecureSkipVerify: z.boolean(),
      SMTPForceAuthLogin: z.boolean(),
      QuotaRemindEnabled: z.boolean(),
      // Entered as a display amount; stored in quota units.
      QuotaRemindThreshold: z.string().refine((value) => {
        const trimmed = value.trim()
        if (!trimmed) return true
        return Number.isFinite(Number(trimmed)) && Number(trimmed) >= 0
      }, t('Must be greater than or equal to 0')),
    })
    .superRefine((values, context) => {
      if (values.EmailProvider === 'resend') {
        if (!values.ResendKeyConfigured && !values.ResendApiKey.trim()) {
          context.addIssue({
            code: 'custom',
            path: ['ResendApiKey'],
            message: t('Configure a Resend API key before enabling Resend'),
          })
        }
        const from = values.ResendFrom.trim()
        if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from)) {
          context.addIssue({
            code: 'custom',
            path: ['ResendFrom'],
            message: t('Enter a valid sender email address'),
          })
        }
        const name = values.ResendSenderName
        if (/[\r\n]/.test(name) || name.includes('\0')) {
          context.addIssue({
            code: 'custom',
            path: ['ResendSenderName'],
            message: t(
              'Sender name must not contain line breaks or null characters'
            ),
          })
        }
        return
      }
      const port = values.SMTPPort.trim()
      if (
        port &&
        (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['SMTPPort'],
          message: t('Port must be a positive integer'),
        })
      }
      const from = values.SMTPFrom.trim()
      if (from && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) {
        context.addIssue({
          code: 'custom',
          path: ['SMTPFrom'],
          message: t('Enter a valid email or leave blank'),
        })
      }
    })

export type EmailFormValues = z.infer<ReturnType<typeof createEmailSchema>>

// Keep the existing ResendFrom option/API contract while editing its two parts.
export function parseResendSender(value: string) {
  const named = value.trim().match(/^(.*?)\s*<([^<>]+)>$/)
  if (!named) return { ResendFrom: value.trim(), ResendSenderName: '' }
  let name = named[1].trim()
  if (name.startsWith('"') && name.endsWith('"')) {
    name = name.slice(1, -1).replaceAll(/\\(.)/g, '$1')
  }
  return { ResendFrom: named[2].trim(), ResendSenderName: name }
}
