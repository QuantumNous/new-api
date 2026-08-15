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

// The sync service only fetches http(s) URLs
// (service/auto_pricing_sync.go), so other schemes are rejected here instead
// of failing later on the server.
const httpUrl = z
  .string()
  .trim()
  .url()
  .refine(
    (value) => value.startsWith('https://') || value.startsWith('http://'),
    { message: 'URL must start with http:// or https://' }
  )

// The backend clamps intervals below 5 minutes back to the 60-minute default
// (setting/ratio_setting/auto_price_setting.go), so the form rejects them up
// front instead of silently saving a value the server will ignore.
export const autoPricingFormSchema = z.object({
  enabled: z.boolean(),
  remoteUrl: httpUrl,
  hashUrl: z.union([httpUrl, z.literal('')]),
  modelsDevUrl: httpUrl,
  checkIntervalMinutes: z.coerce.number().int().min(5).max(10080),
  fuzzyMatchEnabled: z.boolean(),
})

export type AutoPricingFormValues = z.infer<typeof autoPricingFormSchema>

export type AutoPricingDefaults = {
  enabled: boolean
  remoteUrl: string
  hashUrl: string
  modelsDevUrl: string
  checkIntervalMinutes: number
  fuzzyMatchEnabled: boolean
}
