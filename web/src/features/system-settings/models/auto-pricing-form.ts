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

const httpsUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => value.startsWith('https://'), {
    message: 'URL must start with https://',
  })

const proxyUrl = z.union([
  z
    .string()
    .trim()
    .url()
    .refine((value) => /^(?:https?|socks5h?):\/\//i.test(value), {
      message: 'Proxy URL must use HTTP, HTTPS, SOCKS5, or SOCKS5H',
    }),
  z.literal(''),
])

export function parseAllowedHosts(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\s,]+/)
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean)
    ),
  ]
}

const allowedHosts = z.string().superRefine((value, context) => {
  const hosts = parseAllowedHosts(value)
  if (hosts.length === 0) {
    context.addIssue({
      code: 'custom',
      message: 'At least one host is required',
    })
    return
  }
  for (const host of hosts) {
    if (
      host.includes('/') ||
      host.includes(':') ||
      host.includes('@') ||
      !host.includes('.')
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Enter host names only, without schemes, paths, or ports',
      })
      return
    }
  }
})

// The backend clamps intervals below 5 minutes back to the 60-minute default
// (setting/ratio_setting/auto_price_setting.go), so the form rejects them up
// front instead of silently saving a value the server will ignore.
export const autoPricingFormSchema = z.object({
  enabled: z.boolean(),
  remoteUrl: httpsUrl,
  hashUrl: z.union([httpsUrl, z.literal('')]),
  allowedHosts,
  proxyUrl,
  allowDirectOnProxyFailure: z.boolean(),
  checkIntervalMinutes: z.coerce.number().int().min(5).max(10080),
  fuzzyMatchEnabled: z.boolean(),
})

export type AutoPricingFormValues = z.infer<typeof autoPricingFormSchema>

export type AutoPricingDefaults = {
  enabled: boolean
  remoteUrl: string
  hashUrl: string
  allowedHosts: string[]
  proxyUrl: string
  allowDirectOnProxyFailure: boolean
  checkIntervalMinutes: number
  fuzzyMatchEnabled: boolean
}
