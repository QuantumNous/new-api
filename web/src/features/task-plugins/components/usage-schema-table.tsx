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

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { BillingUsageSchema } from '@/features/pricing/types'
import { cn } from '@/lib/utils'

type UsageSchemaTableProps = {
  schema: BillingUsageSchema
  compact?: boolean
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
  const { t } = useTranslation()
  const entries = Object.entries(schema).sort(([left], [right]) =>
    left.localeCompare(right)
  )

  return (
    <div className='overflow-x-auto rounded-md border'>
      <Table className={cn(compact && 'text-xs')}>
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
                {definition.type === 'number' ? t('Number') : t('Enum')}
              </TableCell>
              <TableCell>{formatUsageUnit(definition.unit, t)}</TableCell>
              <TableCell className='font-mono'>
                {definition.enum?.join(', ') || '—'}
              </TableCell>
              <TableCell className='min-w-48 whitespace-normal'>
                {definition.description || '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
