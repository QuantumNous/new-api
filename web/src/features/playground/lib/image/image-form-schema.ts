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

export const IMAGE_MAX_N = 4
export const IMAGE_PROMPT_MAX_CHARS = 4000

const autoOption = z.literal('auto')
const sizeOption = z
  .union([autoOption, z.enum(['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792'])])
  .default('auto')
const qualityOption = z
  .union([autoOption, z.enum(['standard', 'hd'])])
  .default('auto')
const responseFormatOption = z
  .union([autoOption, z.enum(['url', 'b64_json'])])
  .default('auto')

export const imageFormSchema = z.object({
  group: z.string().min(1),
  model: z.string().min(1),
  prompt: z
    .string()
    .trim()
    .min(1)
    .max(IMAGE_PROMPT_MAX_CHARS),
  n: z
    .number()
    .int()
    .min(1)
    .max(IMAGE_MAX_N),
  size: sizeOption,
  quality: qualityOption,
  response_format: responseFormatOption,
})

export type ImageFormInput = z.input<typeof imageFormSchema>
export type ImageFormValues = z.output<typeof imageFormSchema>
