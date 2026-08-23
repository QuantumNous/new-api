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
import { Code2, Copy, Eye, Plus, Trash2 } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { JsonCodeEditor } from '@/components/json-code-editor'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

import { useUpdateOption } from '../hooks/use-update-option'
import {
  createEmptySeedanceRow,
  DEFAULT_SEEDANCE_PRICES,
  parseSeedancePriceTable,
  rowHasInvalidPrice,
  rowsToTable,
  SEEDANCE_PRICE_OPTION_KEY,
  SEEDANCE_RESOLUTIONS,
  tableToRows,
  type SeedancePriceRow,
  type SeedanceResolution,
} from './seedance-price'

type SeedancePriceSettingsProps = {
  defaultValue: string
}

export const SeedancePriceSettings = memo(function SeedancePriceSettings({
  defaultValue,
}: SeedancePriceSettingsProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [editMode, setEditMode] = useState<'visual' | 'json'>('visual')
  const [rows, setRows] = useState<SeedancePriceRow[]>([])
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [nextRowId, setNextRowId] = useState(1)

  useEffect(() => {
    const table = parseSeedancePriceTable(defaultValue)
    const initialRows = tableToRows(table)
    setRows(initialRows)
    setJsonText(JSON.stringify(table, null, 2))
    setJsonError('')
    setNextRowId(initialRows.length + 1)
  }, [defaultValue])

  const currentTable = useMemo(() => rowsToTable(rows), [rows])
  const invalidRowIds = useMemo(
    () => new Set(rows.filter(rowHasInvalidPrice).map((row) => row.id)),
    [rows]
  )

  const syncFromRows = useCallback((nextRows: SeedancePriceRow[]) => {
    setRows(nextRows)
    setJsonText(JSON.stringify(rowsToTable(nextRows), null, 2))
    setJsonError('')
  }, [])

  const handleJsonChange = useCallback(
    (text: string) => {
      setJsonText(text)
      try {
        const parsed = JSON.parse(text) as unknown
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setJsonError(t('JSON must be an object'))
          return
        }
        const table = parseSeedancePriceTable(text)
        const nextRows = tableToRows(table)
        setRows(nextRows)
        setNextRowId(nextRows.length + 1)
        setJsonError('')
      } catch (error) {
        setJsonError(error instanceof Error ? error.message : t('Invalid JSON'))
      }
    },
    [t]
  )

  const updateModel = useCallback(
    (id: number, model: string) => {
      syncFromRows(rows.map((row) => (row.id === id ? { ...row, model } : row)))
    },
    [rows, syncFromRows]
  )

  const updateCell = useCallback(
    (
      id: number,
      bucket: 'text' | 'video',
      resolution: SeedanceResolution,
      value: string
    ) => {
      syncFromRows(
        rows.map((row) =>
          row.id === id
            ? {
                ...row,
                [bucket]: {
                  ...row[bucket],
                  [resolution]: value,
                },
              }
            : row
        )
      )
    },
    [rows, syncFromRows]
  )

  const addRow = useCallback(() => {
    syncFromRows([...rows, createEmptySeedanceRow(nextRowId)])
    setNextRowId((prev) => prev + 1)
  }, [nextRowId, rows, syncFromRows])

  const removeRow = useCallback(
    (id: number) => {
      syncFromRows(rows.filter((row) => row.id !== id))
    },
    [rows, syncFromRows]
  )

  const resetToDefault = useCallback(() => {
    const initialRows = tableToRows(DEFAULT_SEEDANCE_PRICES)
    setRows(initialRows)
    setJsonText(JSON.stringify(DEFAULT_SEEDANCE_PRICES, null, 2))
    setJsonError('')
    setNextRowId(initialRows.length + 1)
  }, [])

  const handleCopyJson = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(jsonText)
      toast.success(t('Copied to clipboard'))
    } catch {
      toast.error(t('Failed to copy'))
    }
  }, [jsonText, t])

  const handleSave = useCallback(async () => {
    if (invalidRowIds.size > 0) {
      toast.error(t('Please enter a valid number'))
      return
    }
    if (editMode === 'json' && jsonError) {
      toast.error(t('Please fix JSON errors before saving'))
      return
    }
    await updateOption.mutateAsync({
      key: SEEDANCE_PRICE_OPTION_KEY,
      value: JSON.stringify(currentTable),
    })
  }, [currentTable, editMode, invalidRowIds.size, jsonError, t, updateOption])

  const toggleEditMode = useCallback(() => {
    setEditMode((prev) => (prev === 'visual' ? 'json' : 'visual'))
  }, [])

  return (
    <div className='space-y-4'>
      <Alert>
        <AlertDescription className='space-y-1 text-sm'>
          <div>
            {t(
              'Configure Seedance 2.0/2.5 list prices in RMB per million tokens. This table only controls the resolution and video-input surcharge. Selling prices stay in Model ratio.'
            )}
          </div>
        </AlertDescription>
      </Alert>

      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex flex-wrap items-center gap-2'>
          {editMode === 'visual' ? (
            <>
              <Button variant='outline' size='sm' onClick={addRow}>
                <Plus className='mr-2 h-4 w-4' />
                {t('Add')}
              </Button>
              <Button variant='ghost' size='sm' onClick={resetToDefault}>
                {t('Restore defaults')}
              </Button>
            </>
          ) : (
            <>
              <Button variant='ghost' size='sm' onClick={handleCopyJson}>
                <Copy className='mr-2 h-4 w-4' />
                {t('Copy')}
              </Button>
              <Button variant='ghost' size='sm' onClick={resetToDefault}>
                {t('Restore defaults')}
              </Button>
            </>
          )}
        </div>
        <Button variant='outline' size='sm' onClick={toggleEditMode}>
          {editMode === 'visual' ? (
            <>
              <Code2 className='mr-2 h-4 w-4' />
              {t('Switch to JSON')}
            </>
          ) : (
            <>
              <Eye className='mr-2 h-4 w-4' />
              {t('Switch to Visual')}
            </>
          )}
        </Button>
      </div>

      {editMode === 'visual' ? (
        <div className='space-y-3'>
          {rows.length === 0 ? (
            <p className='text-muted-foreground py-8 text-center text-sm'>
              {t('No Seedance prices configured')}
            </p>
          ) : (
            rows.map((row) => (
              <SeedancePriceCard
                key={row.id}
                row={row}
                invalid={invalidRowIds.has(row.id)}
                onModelChange={(value) => updateModel(row.id, value)}
                onCellChange={(bucket, resolution, value) =>
                  updateCell(row.id, bucket, resolution, value)
                }
                onRemove={() => removeRow(row.id)}
              />
            ))
          )}
        </div>
      ) : (
        <div className='space-y-2'>
          <JsonCodeEditor
            value={jsonText}
            onChange={handleJsonChange}
            heightClassName='h-72 min-h-72 max-h-72'
            aria-invalid={Boolean(jsonError)}
          />
          {jsonError && <p className='text-destructive text-sm'>{jsonError}</p>}
        </div>
      )}

      <div className='flex justify-end'>
        <Button
          onClick={handleSave}
          disabled={
            updateOption.isPending ||
            invalidRowIds.size > 0 ||
            (editMode === 'json' && !!jsonError)
          }
        >
          {t('Save Seedance prices')}
        </Button>
      </div>
    </div>
  )
})

function SeedancePriceCard({
  row,
  invalid,
  onModelChange,
  onCellChange,
  onRemove,
}: {
  row: SeedancePriceRow
  invalid: boolean
  onModelChange: (value: string) => void
  onCellChange: (
    bucket: 'text' | 'video',
    resolution: SeedanceResolution,
    value: string
  ) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className='space-y-3 rounded-md border p-3'>
      <div className='flex items-start gap-2'>
        <Input
          value={row.model}
          placeholder='doubao-seedance-2-0-260128'
          aria-label={t('Model name')}
          onChange={(event) => onModelChange(event.target.value)}
        />
        <Button
          variant='ghost'
          size='icon'
          onClick={onRemove}
          aria-label={t('Delete')}
        >
          <Trash2 className='text-destructive h-4 w-4' />
        </Button>
      </div>
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        {SEEDANCE_RESOLUTIONS.map((resolution) => (
          <div key={resolution} className='space-y-2'>
            <p className='text-muted-foreground text-xs font-medium uppercase'>
              {resolution === '4k' ? '4K' : resolution}
            </p>
            <Field data-invalid={invalid}>
              <Input
                type='number'
                min={0}
                step={0.1}
                value={row.text[resolution]}
                placeholder={t('No video input')}
                aria-label={`${row.model || t('Model name')} ${resolution} ${t('No video input')}`}
                onChange={(event) =>
                  onCellChange('text', resolution, event.target.value)
                }
              />
            </Field>
            <Field data-invalid={invalid}>
              <Input
                type='number'
                min={0}
                step={0.1}
                value={row.video[resolution]}
                placeholder={t('With video input')}
                aria-label={`${row.model || t('Model name')} ${resolution} ${t('With video input')}`}
                onChange={(event) =>
                  onCellChange('video', resolution, event.target.value)
                }
              />
            </Field>
          </div>
        ))}
      </div>
      {invalid ? (
        <FieldError>{t('Please enter a valid number')}</FieldError>
      ) : null}
    </div>
  )
}
