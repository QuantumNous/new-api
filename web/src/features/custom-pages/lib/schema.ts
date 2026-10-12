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

import {
  isCustomPageURL,
  MAX_CUSTOM_PAGES,
  MAX_CUSTOM_PAGE_NAME_LENGTH,
  MAX_CUSTOM_PAGE_URL_LENGTH,
} from '@/lib/custom-pages'

export const customPagesSchema = z
  .object({
    pages: z
      .array(
        z.object({
          name: z
            .string()
            .refine(
              (name) => !/[\r\n\t]/.test(name),
              'Name cannot contain newlines or tabs'
            )
            .trim()
            .min(1, 'Name is required')
            .refine(
              (name) => [...name].length <= MAX_CUSTOM_PAGE_NAME_LENGTH,
              'Name cannot exceed 30 characters'
            ),
          url: z
            .string()
            .trim()
            .min(1, 'URL is required')
            .refine(
              (url) => [...url].length <= MAX_CUSTOM_PAGE_URL_LENGTH,
              'URL cannot exceed 500 characters'
            )
            .refine(isCustomPageURL, 'URL must start with http:// or https://'),
          adminOnly: z.boolean(),
          highlight: z.boolean(),
        })
      )
      .max(MAX_CUSTOM_PAGES, 'At most 20 pages are supported'),
  })
  .superRefine((values, ctx) => {
    const names = new Set<string>()
    values.pages.forEach((page, index) => {
      const name = page.name.toLowerCase()
      if (names.has(name)) {
        ctx.addIssue({
          code: 'custom',
          path: ['pages', index, 'name'],
          message: 'Menu names must be unique',
        })
      }
      names.add(name)
    })
  })

export type CustomPagesFormValues = z.infer<typeof customPagesSchema>
