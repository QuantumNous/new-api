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

export function createGroupMigrationSchema(t: (key: string) => string) {
  return z
    .object({
      source: z.string().min(1, t('Required')),
      target: z
        .string()
        .min(1, t('Required'))
        .refine(
          (name) =>
            [...name].length <= 50 &&
            !/[,\p{White_Space}\p{Cc}]|^[+-]:/u.test(name),
          t(
            'Group names must contain 1 to 50 characters without commas, whitespace, control characters or rule prefixes.'
          )
        )
        .refine(
          (name) => name !== 'default' && name !== 'auto',
          t('Built-in groups cannot participate in migration.')
        ),
    })
    .refine((names) => names.source !== names.target, {
      path: ['target'],
      message: t('Source and target groups must differ.'),
    })
}

export type GroupMigrationNames = z.infer<
  ReturnType<typeof createGroupMigrationSchema>
>
