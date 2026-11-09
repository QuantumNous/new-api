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

import type { IQConfig, IQConfigInput, IQTarget } from './types'

const message = 'Invalid IQ configuration'
export const iqConfigSchema = z
  .object({
    version: z.number().int(),
    prompt: z
      .string()
      .refine(
        (value) =>
          value.trim().length > 0 &&
          new TextEncoder().encode(value).length <= 65_536,
        message
      ),
    targets: z.array(
      z.object({ group: z.string(), models: z.array(z.string()) })
    ),
    enabled: z.boolean(),
    schedule_mode: z.enum(['interval', 'daily']),
    interval_hours: z.number(),
    daily_time: z.string(),
    timezone: z.literal('Asia/Shanghai'),
  })
  .superRefine((value, context) => {
    const pairs = value.targets.reduce(
      (count, target) => count + target.models.length,
      0
    )
    if (pairs > 100 || (value.enabled && pairs === 0)) {
      context.addIssue({ code: 'custom', path: ['targets'], message })
    }
    if (
      value.schedule_mode === 'interval' &&
      (!Number.isInteger(value.interval_hours) ||
        value.interval_hours < 1 ||
        value.interval_hours > 8760)
    ) {
      context.addIssue({ code: 'custom', path: ['interval_hours'], message })
    }
    if (
      value.schedule_mode === 'daily' &&
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.daily_time)
    ) {
      context.addIssue({ code: 'custom', path: ['daily_time'], message })
    }
  })

export function editableIQConfig(config: IQConfig): IQConfigInput {
  return {
    version: config.version,
    prompt: config.prompt,
    targets: config.targets,
    enabled: config.enabled,
    schedule_mode: config.schedule_mode,
    interval_hours: config.interval_hours,
    daily_time: config.daily_time,
    timezone: config.timezone,
  }
}

export function setIQModels(
  targets: IQTarget[],
  group: string,
  models: string[]
): IQTarget[] {
  return [
    ...targets.filter((target) => target.group !== group),
    ...(models.length ? [{ group, models }] : []),
  ]
}
