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

const manualAvailabilitySchema = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || Number.isFinite(Number(value)),
    'Enter a number'
  )
  .refine(
    (value) => value === '' || (Number(value) >= 0 && Number(value) <= 100),
    'Availability must be between 0 and 100'
  )

export function parseManualAvailability(value: string): number | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : Number(trimmed)
}

export const channelMonitorFormSchema = z.object({
  name: z.string().trim().min(1, 'Monitor name is required').max(100),
  api_url: z
    .string()
    .trim()
    .url('Enter a valid API URL')
    .refine(
      (value) => value.startsWith('http://') || value.startsWith('https://'),
      'API URL must use HTTP or HTTPS'
    ),
  api_key: z.string().trim().max(5000),
  test_model: z.string().trim().min(1, 'Test model is required').max(200),
  interval_seconds: z.coerce
    .number()
    .int('Enter a whole number')
    .min(1, 'Test interval must be at least 1 second')
    .max(86400, 'Test interval cannot exceed 86400 seconds'),
  timeout_seconds: z.coerce
    .number()
    .int('Enter a whole number')
    .min(1, 'Request timeout must be at least 1 second')
    .max(120, 'Request timeout cannot exceed 120 seconds'),
  enabled: z.boolean(),
  visible: z.boolean(),
  manual_availability_7d: manualAvailabilitySchema,
  manual_availability_30d: manualAvailabilitySchema,
})

export type ChannelMonitorFormInput = z.input<typeof channelMonitorFormSchema>
export type ChannelMonitorFormValues = z.output<typeof channelMonitorFormSchema>

export const channelMonitorFormDefaults: ChannelMonitorFormInput = {
  name: '',
  api_url: '',
  api_key: '',
  test_model: '',
  interval_seconds: 300,
  timeout_seconds: 15,
  enabled: true,
  visible: true,
  manual_availability_7d: '',
  manual_availability_30d: '',
}
