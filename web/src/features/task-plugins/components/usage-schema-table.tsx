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
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { BillingUsageSchema } from '@/features/pricing/types'
import { resolveLocalizedText } from '@/lib/localized-text'

type UsageSchemaTableProps = {
  schema: BillingUsageSchema
  compact?: boolean
}

function getUsageTypeLabelKey(
  type: BillingUsageSchema[string]['type']
): string {
  if (type === 'number') return 'Number'
  if (type === 'boolean') return 'Boolean'
  return 'Enum'
}

function getUsageUnitLabelKey(
  unit: BillingUsageSchema[string]['unit']
): string | null {
  if (unit === 'second') return 'Second'
  if (unit === 'count') return 'Count'
  if (unit === 'token') return 'token (unit)'
  if (unit === 'credit') return 'credit'
  return null
}

function formatUsageUnit(
  unit: BillingUsageSchema[string]['unit'],
  t: (key: string) => string
): string {
  const labelKey = getUsageUnitLabelKey(unit)
  return labelKey ? t(labelKey) : '—'
}

export function UsageSchemaTable({
  schema,
  compact = false,
}: UsageSchemaTableProps) {
  const { t, i18n } = useTranslation()
  const entries = Object.entries(schema).sort(([left], [right]) =>
    left.localeCompare(right)
  )

  // Card view: a five-column table cannot fit a narrow card, so compact mode
  // stacks each field — name + merged type/unit badge on line one, truncated
  // enum values (full list via title) on line two, wrapped description last.
  // The list is height-capped with its own scroll so a long schema cannot
  // stretch the whole card grid row.
  if (compact) {
    return (
      <div className='max-h-56 overflow-y-auto rounded-md border'>
        <ul className='divide-y'>
          {entries.map(([name, definition]) => {
            const enumValues = definition.enum?.join(', ')
            const description = resolveLocalizedText(
              definition.description,
              i18n.language
            )
            const unitLabelKey = getUsageUnitLabelKey(definition.unit)
            const typeLabel = t(getUsageTypeLabelKey(definition.type))
            return (
              <li key={name} className='space-y-1 px-2.5 py-2'>
                <div className='flex items-center justify-between gap-2'>
                  <span
                    className='min-w-0 truncate font-mono text-xs font-medium'
                    title={name}
                  >
                    {name}
                  </span>
                  <Badge variant='secondary' className='font-normal'>
                    {unitLabelKey
                      ? `${typeLabel} · ${t(unitLabelKey)}`
                      : typeLabel}
                  </Badge>
                </div>
                {enumValues ? (
                  <div
                    className='text-muted-foreground truncate font-mono text-[11px]'
                    title={enumValues}
                  >
                    {enumValues}
                  </div>
                ) : null}
                {description ? (
                  <p className='text-muted-foreground text-xs break-words'>
                    {description}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <div className='overflow-x-auto rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Name')}</TableHead>
            <TableHead>{t('Type')}</TableHead>
            <TableHead>{t('Unit')}</TableHead>
            <TableHead>{t('Enum values')}</TableHead>
            <TableHead>{t('Description')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map(([name, definition]) => (
            <TableRow key={name}>
              <TableCell className='font-mono'>{name}</TableCell>
              <TableCell>
                {t(getUsageTypeLabelKey(definition.type))}
              </TableCell>
              <TableCell>{formatUsageUnit(definition.unit, t)}</TableCell>
              <TableCell className='font-mono'>
                {definition.enum?.join(', ') || '—'}
              </TableCell>
              <TableCell className='min-w-48 whitespace-normal'>
                {resolveLocalizedText(definition.description, i18n.language) ||
                  '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
