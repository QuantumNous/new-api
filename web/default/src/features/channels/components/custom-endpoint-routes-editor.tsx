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
import { useCallback, useMemo, useState } from 'react'
import { Code, Plus, Route, Table, Trash2, Wand2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  CUSTOM_ENDPOINT_ROUTES_PLACEHOLDER,
  CUSTOM_ENDPOINT_ROUTE_PRESET_OPTIONS,
  CUSTOM_ENDPOINT_ROUTE_TEMPLATES,
  createEmptyCustomEndpointRouteDraft,
  customEndpointRouteDraftsToJson,
  duplicateCustomEndpointEntryPaths,
  ensureCustomEndpointRouteDraftTransformer,
  formatCustomEndpointRoutes,
  getAllowedCustomEndpointTransformers,
  getCustomEndpointRouteTemplate,
  getCustomEndpointRoutesTextState,
  parseCustomEndpointRoutesText,
  type CustomEndpointRouteDraft,
  type CustomEndpointTransformer,
} from '../lib/custom-endpoint'

type CustomEndpointRoutesEditorProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function CustomEndpointRoutesEditor({
  value,
  onChange,
  disabled = false,
}: CustomEndpointRoutesEditorProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'visual' | 'json'>('visual')
  const routeState = useMemo(
    () => getCustomEndpointRoutesTextState(value, false),
    [value]
  )
  const rows = routeState.drafts
  const validationError = routeState.validationError
  const duplicates = useMemo(
    () => duplicateCustomEndpointEntryPaths(rows),
    [rows]
  )

  const syncRows = useCallback(
    (nextRows: CustomEndpointRouteDraft[]) => {
      onChange(customEndpointRouteDraftsToJson(nextRows))
    },
    [onChange]
  )

  const updateRows = useCallback(
    (
      updater: (
        current: CustomEndpointRouteDraft[]
      ) => CustomEndpointRouteDraft[]
    ) => {
      syncRows(updater(rows))
    },
    [rows, syncRows]
  )

  const handleAddRoute = useCallback(() => {
    updateRows((current) => [
      ...current,
      createEmptyCustomEndpointRouteDraft(current),
    ])
  }, [updateRows])

  const handleDeleteRoute = useCallback(
    (id: string) => {
      updateRows((current) => current.filter((row) => row.id !== id))
    },
    [updateRows]
  )

  const handleRowChange = useCallback(
    (id: string, patch: Partial<CustomEndpointRouteDraft>) => {
      updateRows((current) =>
        current.map((row) => (row.id === id ? { ...row, ...patch } : row))
      )
    },
    [updateRows]
  )

  const handleEntryPathChange = useCallback(
    (id: string, entryPath: string | null) => {
      const nextEntryPath = entryPath || ''
      updateRows((current) =>
        current.map((row) => {
          if (row.id !== id) return row
          const transformer = ensureCustomEndpointRouteDraftTransformer(
            nextEntryPath,
            row.transformer
          )
          return { ...row, entryPath: nextEntryPath, transformer }
        })
      )
    },
    [updateRows]
  )

  const handleJsonChange = useCallback(
    (nextJson: string) => {
      onChange(nextJson)
    },
    [onChange]
  )

  const handleFormatJson = useCallback(() => {
    const { routes, error } = parseCustomEndpointRoutesText(value)
    if (error || !routes) return
    const formatted = formatCustomEndpointRoutes(routes)
    onChange(formatted)
  }, [onChange, value])

  const handleFillTemplate = useCallback(
    (templateId: string) => {
      const template = getCustomEndpointRouteTemplate(templateId)
      if (!template) return
      const nextJson = formatCustomEndpointRoutes(template.routes)
      onChange(nextJson)
    },
    [onChange]
  )

  const toggleMode = useCallback(() => {
    if (mode === 'visual') {
      syncRows(rows)
      setMode('json')
      return
    }

    if (!routeState.parseError) {
      setMode('visual')
    }
  }, [mode, routeState.parseError, rows, syncRows])

  return (
    <div className='border-border/60 bg-muted/10 space-y-4 rounded-lg border p-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div className='space-y-1'>
          <div className='flex items-center gap-2'>
            <Route className='text-muted-foreground h-4 w-4' />
            <div className='text-sm font-semibold'>
              {t('Custom Endpoint Routes')}
            </div>
            <Badge variant='outline'>
              {t('{{count}} route(s)', { count: rows.length })}
            </Badge>
          </div>
          <p className='text-muted-foreground text-xs'>
            {t('Each entry path maps to one final upstream request URL.')}
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={toggleMode}
            disabled={disabled}
          >
            {mode === 'visual' ? (
              <>
                <Code className='mr-2 h-4 w-4' />
                {t('JSON Mode')}
              </>
            ) : (
              <>
                <Table className='mr-2 h-4 w-4' />
                {t('Visual Mode')}
              </>
            )}
          </Button>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={handleAddRoute}
            disabled={disabled || mode === 'json'}
          >
            <Plus className='mr-2 h-4 w-4' />
            {t('Add Route')}
          </Button>
        </div>
      </div>

      <div className='flex flex-wrap gap-2'>
        {CUSTOM_ENDPOINT_ROUTE_TEMPLATES.map((template) => (
          <Button
            key={template.id}
            type='button'
            variant='secondary'
            size='sm'
            onClick={() => handleFillTemplate(template.id)}
            disabled={disabled}
          >
            <Wand2 className='mr-2 h-4 w-4' />
            {t(template.label)}
          </Button>
        ))}
      </div>

      {validationError && (
        <Alert variant='destructive'>
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}
      {duplicates.length > 0 && (
        <Alert>
          <AlertDescription>
            {t('Duplicate entry path(s):')} {duplicates.join(', ')}
          </AlertDescription>
        </Alert>
      )}

      {mode === 'visual' ? (
        <div className='space-y-3'>
          {rows.length === 0 ? (
            <div className='bg-background/60 text-muted-foreground flex min-h-28 items-center justify-center rounded-md border border-dashed text-sm'>
              {t('No custom endpoint routes configured.')}
            </div>
          ) : (
            rows.map((row, index) => {
              const transformerOptions = getAllowedCustomEndpointTransformers(
                row.entryPath
              )
              return (
                <div
                  key={row.id}
                  className='border-border/70 bg-background rounded-md border p-3'
                >
                  <div className='mb-3 flex items-center justify-between gap-3'>
                    <div className='flex items-center gap-2'>
                      <Badge variant='secondary'>
                        {t('Route {{index}}', { index: index + 1 })}
                      </Badge>
                      <span className='text-muted-foreground max-w-[18rem] truncate font-mono text-xs'>
                        {row.entryPath || t('New route')}
                      </span>
                    </div>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon-sm'
                      aria-label={t('Delete route')}
                      onClick={() => handleDeleteRoute(row.id)}
                      disabled={disabled}
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>

                  <div className='grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)]'>
                    <label className='space-y-1.5'>
                      <span className='text-xs font-medium'>
                        {t('Entry Path')}
                      </span>
                      <Combobox
                        options={CUSTOM_ENDPOINT_ROUTE_PRESET_OPTIONS}
                        value={row.entryPath}
                        onValueChange={(nextValue) =>
                          handleEntryPathChange(row.id, nextValue)
                        }
                        placeholder='/v1/chat/completions'
                        searchPlaceholder={t('Search or enter entry path')}
                        emptyText={t('No route preset found.')}
                        allowCustomValue
                      />
                    </label>

                    <label className='space-y-1.5'>
                      <span className='text-xs font-medium'>
                        {t('Final Request URL')}
                      </span>
                      <Input
                        value={row.path}
                        onChange={(event) =>
                          handleRowChange(row.id, {
                            path: event.target.value,
                          })
                        }
                        placeholder='https://api.example.com/v1/chat/completions'
                        disabled={disabled}
                        className='font-mono text-xs'
                      />
                    </label>
                  </div>

                  <div className='mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]'>
                    <label className='space-y-1.5'>
                      <span className='text-xs font-medium'>
                        {t('Transformer')}
                      </span>
                      <Select
                        value={row.transformer}
                        onValueChange={(nextValue) =>
                          handleRowChange(row.id, {
                            transformer: nextValue as CustomEndpointTransformer,
                          })
                        }
                      >
                        <SelectTrigger disabled={disabled}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                          <SelectGroup>
                            {transformerOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {t(option.label)}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </label>

                    <label className='border-border/60 flex min-w-48 items-center justify-between gap-3 rounded-md border px-3 py-2'>
                      <span className='text-xs font-medium'>
                        {t('Stream Options')}
                      </span>
                      <Switch
                        checked={row.streamOptionsSupported}
                        onCheckedChange={(checked) =>
                          handleRowChange(row.id, {
                            streamOptionsSupported: checked,
                          })
                        }
                        disabled={disabled}
                      />
                    </label>
                  </div>
                </div>
              )
            })
          )}
        </div>
      ) : (
        <div className='space-y-2'>
          <div className='flex justify-end gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={handleFormatJson}
              disabled={disabled || Boolean(validationError)}
            >
              {t('Format')}
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => handleJsonChange('')}
              disabled={disabled}
            >
              {t('Clear')}
            </Button>
          </div>
          <Textarea
            value={value}
            onChange={(event) => handleJsonChange(event.target.value)}
            disabled={disabled}
            rows={14}
            className='min-h-72 resize-y font-mono text-xs'
            placeholder={CUSTOM_ENDPOINT_ROUTES_PLACEHOLDER}
          />
        </div>
      )}

      <div className='text-muted-foreground grid gap-2 border-t pt-3 text-xs sm:grid-cols-3'>
        <div>
          <span className='text-foreground font-medium'>{t('Entry Path')}</span>
          <br />
          {t('Path only, no query string.')}
        </div>
        <div>
          <span className='text-foreground font-medium'>
            {t('Final Request URL')}
          </span>
          <br />
          {t('Full URL, supports query and {model}.')}
        </div>
        <div>
          <span className='text-foreground font-medium'>
            {t('Transformer')}
          </span>
          <br />
          {t('Required fixed enum, no raw passthrough.')}
        </div>
      </div>
    </div>
  )
}
