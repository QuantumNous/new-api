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
import { useState, useMemo } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { safeJsonParseWithValidation } from '../utils/json-parser'
import { isObjectRecord } from '../utils/json-validators'
import { RateLimitDialog, type RateLimitEntryData } from './rate-limit-dialog'

type RateLimitVisualEditorProps = {
  value: string
  onChange: (value: string) => void
  concurrencyValue: string
  onConcurrencyChange: (value: string) => void
}

type RateLimitEntry = RateLimitEntryData

const parseRateLimitMap = (value: string) =>
  safeJsonParseWithValidation<Record<string, unknown>>(value, {
    fallback: {},
    validator: isObjectRecord,
    validatorMessage: 'Rate limits must be a JSON object',
    context: 'rate limits',
  })

const parseConcurrencyLimitMap = (value: string) =>
  safeJsonParseWithValidation<Record<string, unknown>>(value, {
    fallback: {},
    validator: isObjectRecord,
    validatorMessage: 'Concurrency limits must be a JSON object',
    context: 'concurrency limits',
  })

const stringifyMap = (value: Record<string, unknown>) =>
  JSON.stringify(value, null, 2)

export function RateLimitVisualEditor({
  value,
  onChange,
  concurrencyValue,
  onConcurrencyChange,
}: RateLimitVisualEditorProps) {
  const { t } = useTranslation()
  const [searchText, setSearchText] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editData, setEditData] = useState<RateLimitEntry | null>(null)

  const rateLimits = useMemo(() => {
    const rateParsed = !value || value.trim() === '' ? {} : parseRateLimitMap(value)
    const concurrencyParsed =
      !concurrencyValue || concurrencyValue.trim() === ''
        ? {}
        : parseConcurrencyLimitMap(concurrencyValue)
    const groupNames = new Set([
      ...Object.keys(rateParsed),
      ...Object.keys(concurrencyParsed),
    ])

    return [...groupNames]
      .sort((a, b) => a.localeCompare(b))
      .map((groupName) => {
        const limits = rateParsed[groupName]
        const concurrentLimit = concurrencyParsed[groupName]
        const entry: RateLimitEntry = { groupName }

        if (
          Array.isArray(limits) &&
          limits.length === 2 &&
          typeof limits[0] === 'number' &&
          typeof limits[1] === 'number'
        ) {
          entry.maxRequests = limits[0]
          entry.maxSuccess = limits[1]
        }

        if (typeof concurrentLimit === 'number') {
          entry.maxConcurrent = concurrentLimit
        }

        return entry.maxRequests !== undefined ||
          entry.maxSuccess !== undefined ||
          entry.maxConcurrent !== undefined
          ? entry
          : null
      })
      .filter((item): item is RateLimitEntry => item !== null)
  }, [value, concurrencyValue])

  const filteredRateLimits = useMemo(() => {
    if (!searchText) return rateLimits
    const lowerSearch = searchText.toLowerCase()
    return rateLimits.filter((limit) =>
      limit.groupName.toLowerCase().includes(lowerSearch)
    )
  }, [rateLimits, searchText])

  const handleSave = (data: RateLimitEntryData) => {
    const parsed = parseRateLimitMap(value)
    const concurrencyParsed = parseConcurrencyLimitMap(concurrencyValue)

    if (editData && editData.groupName !== data.groupName) {
      delete parsed[editData.groupName]
      delete concurrencyParsed[editData.groupName]
    }

    if (data.maxRequests !== undefined && data.maxSuccess !== undefined) {
      parsed[data.groupName] = [data.maxRequests, data.maxSuccess]
    } else {
      delete parsed[data.groupName]
    }

    if (data.maxConcurrent !== undefined) {
      concurrencyParsed[data.groupName] = data.maxConcurrent
    } else {
      delete concurrencyParsed[data.groupName]
    }

    onChange(stringifyMap(parsed))
    onConcurrencyChange(stringifyMap(concurrencyParsed))
  }

  const handleDelete = (groupName: string) => {
    const parsed = parseRateLimitMap(value)
    const concurrencyParsed = parseConcurrencyLimitMap(concurrencyValue)

    delete parsed[groupName]
    delete concurrencyParsed[groupName]

    onChange(stringifyMap(parsed))
    onConcurrencyChange(stringifyMap(concurrencyParsed))
  }

  const handleEdit = (limit: RateLimitEntry) => {
    setEditData(limit)
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setEditData(null)
    setDialogOpen(true)
  }

  const renderOptionalNumber = (
    value: number | undefined,
    unlimitedLabel = false
  ) => {
    if (value === undefined) return t('Default')
    if (unlimitedLabel && value === 0) return t('Unlimited')
    return value.toLocaleString()
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-4'>
        <div className='relative flex-1'>
          <Search className='text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4' />
          <Input
            placeholder={t('Search group names...')}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className='pl-9'
          />
        </div>
        <Button type='button' onClick={handleAdd}>
          <Plus className='mr-2 h-4 w-4' />
          {t('Add group')}
        </Button>
      </div>

      {filteredRateLimits.length === 0 ? (
        <div className='text-muted-foreground rounded-lg border border-dashed p-8 text-center'>
          {searchText
            ? t('No groups match your search')
            : t(
                'No group-based rate limits configured. Click "Add group" to get started.'
              )}
        </div>
      ) : (
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Group Name')}</TableHead>
                <TableHead className='text-right'>
                  {t('Max Requests (incl. failures)')}
                </TableHead>
                <TableHead className='text-right'>{t('Max Success')}</TableHead>
                <TableHead className='text-right'>
                  {t('Max concurrent requests')}
                </TableHead>
                <TableHead className='text-right'>{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRateLimits.map((limit) => (
                <TableRow key={limit.groupName}>
                  <TableCell className='font-medium'>
                    {limit.groupName}
                  </TableCell>
                  <TableCell className='text-right'>
                    <span className='font-mono'>
                      {renderOptionalNumber(limit.maxRequests, true)}
                    </span>
                  </TableCell>
                  <TableCell className='text-right'>
                    <span className='font-mono'>
                      {renderOptionalNumber(limit.maxSuccess)}
                    </span>
                  </TableCell>
                  <TableCell className='text-right'>
                    <span className='font-mono'>
                      {renderOptionalNumber(limit.maxConcurrent, true)}
                    </span>
                  </TableCell>
                  <TableCell className='text-right'>
                    <div className='flex justify-end gap-2'>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => handleEdit(limit)}
                      >
                        <Pencil className='h-4 w-4' />
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => handleDelete(limit.groupName)}
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <RateLimitDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        editData={editData}
      />
    </div>
  )
}
