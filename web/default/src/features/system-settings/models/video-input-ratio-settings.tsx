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
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Code2, Copy, Eye, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { Textarea } from '@/components/ui/textarea'
import { useUpdateOption } from '../hooks/use-update-option'

const OPTION_KEY = 'billing_setting.video_input_ratio'

const DEFAULT_RATIOS: Record<string, number> = {
  'doubao-seedance-2-0-260128': 28 / 46,
  'doubao-seedance-2-0-fast-260128': 22 / 37,
}

type VideoInputRatioRow = {
  id: number
  model: string
  ratio: number
}

function rowsToObject(rows: VideoInputRatioRow[]): Record<string, number> {
  const ratios: Record<string, number> = {}
  for (const row of rows) {
    const model = row.model.trim()
    if (!model) continue
    ratios[model] = Number(row.ratio) || 0
  }
  return ratios
}

function objectToRows(ratios: Record<string, number>): VideoInputRatioRow[] {
  return Object.entries(ratios).map(([model, ratio], index) => ({
    id: index + 1,
    model,
    ratio: Number(ratio) || 0,
  }))
}

function parseInitialRatios(
  rawValue: string | undefined
): Record<string, number> {
  if (!rawValue) return { ...DEFAULT_RATIOS }
  try {
    const parsed = JSON.parse(rawValue) as unknown
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      Object.keys(parsed as object).length > 0
    ) {
      return parsed as Record<string, number>
    }
  } catch {
    // fall through to defaults
  }
  return { ...DEFAULT_RATIOS }
}

type VideoInputRatioSettingsProps = {
  defaultValue: string
}

export const VideoInputRatioSettings = memo(function VideoInputRatioSettings({
  defaultValue,
}: VideoInputRatioSettingsProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [editMode, setEditMode] = useState<'visual' | 'json'>('visual')
  const [rows, setRows] = useState<VideoInputRatioRow[]>([])
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [nextRowId, setNextRowId] = useState(1)

  useEffect(() => {
    const ratios = parseInitialRatios(defaultValue)
    const initialRows = objectToRows(ratios)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(initialRows)
    setJsonText(JSON.stringify(ratios, null, 2))
    setJsonError('')
    setNextRowId(initialRows.length + 1)
  }, [defaultValue])

  const currentRatios = useMemo(() => rowsToObject(rows), [rows])

  const syncFromRows = useCallback((nextRows: VideoInputRatioRow[]) => {
    setRows(nextRows)
    setJsonText(JSON.stringify(rowsToObject(nextRows), null, 2))
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
        const nextRows = objectToRows(parsed as Record<string, number>)
        setRows(nextRows)
        setNextRowId(nextRows.length + 1)
        setJsonError('')
      } catch (error) {
        setJsonError(error instanceof Error ? error.message : t('Invalid JSON'))
      }
    },
    [t]
  )

  const updateRow = useCallback(
    (id: number, field: 'model' | 'ratio', value: string | number) => {
      syncFromRows(
        rows.map((r) => (r.id === id ? { ...r, [field]: value } : r))
      )
    },
    [rows, syncFromRows]
  )

  const addRow = useCallback(() => {
    const newRow: VideoInputRatioRow = { id: nextRowId, model: '', ratio: 1 }
    setNextRowId((prev) => prev + 1)
    syncFromRows([...rows, newRow])
  }, [nextRowId, rows, syncFromRows])

  const removeRow = useCallback(
    (id: number) => {
      syncFromRows(rows.filter((r) => r.id !== id))
    },
    [rows, syncFromRows]
  )

  const resetToDefault = useCallback(() => {
    const initialRows = objectToRows(DEFAULT_RATIOS)
    setRows(initialRows)
    setJsonText(JSON.stringify(DEFAULT_RATIOS, null, 2))
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
    if (editMode === 'json' && jsonError) {
      toast.error(t('Please fix JSON errors before saving'))
      return
    }
    await updateOption.mutateAsync({
      key: OPTION_KEY,
      value: JSON.stringify(currentRatios),
    })
  }, [currentRatios, editMode, jsonError, t, updateOption])

  const toggleEditMode = useCallback(() => {
    setEditMode((prev) => (prev === 'visual' ? 'json' : 'visual'))
  }, [])

  return (
    <div className='space-y-4'>
      <Alert>
        <AlertDescription className='space-y-2 text-sm'>
          <div>
            {t(
              'When a video generation request includes video reference input (e.g. content with video_url), billing multiplies ModelRatio by this discount ratio.'
            )}
          </div>
          <div>
            {t(
              'Set ModelRatio to the higher price without video reference. Ratio = with-video unit price ÷ without-video unit price (e.g. 28÷46 ≈ 0.6087).'
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
        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Model name')}</TableHead>
                <TableHead className='w-[220px]'>
                  {t('Video reference ratio')}
                </TableHead>
                <TableHead className='w-[80px] text-right'>
                  {t('Actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className='text-muted-foreground h-24 text-center'>
                    {t('No entries yet')}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Input
                        value={row.model}
                        onChange={(e) =>
                          updateRow(row.id, 'model', e.target.value)
                        }
                        placeholder='doubao-seedance-2-0-260128'
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type='number'
                        step='0.0001'
                        min='0'
                        value={row.ratio}
                        onChange={(e) =>
                          updateRow(row.id, 'ratio', e.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => removeRow(row.id)}
                        aria-label={t('Delete')}
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className='space-y-2'>
          <Textarea
            rows={14}
            value={jsonText}
            onChange={(e) => handleJsonChange(e.target.value)}
            className='font-mono text-sm'
          />
          {jsonError ? (
            <p className='text-destructive text-sm'>{jsonError}</p>
          ) : null}
        </div>
      )}

      <Button onClick={handleSave} disabled={updateOption.isPending}>
        {updateOption.isPending ? t('Saving...') : t('Save video input ratios')}
      </Button>
    </div>
  )
})
