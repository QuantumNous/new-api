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
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  ArrowDownUp,
  Calendar,
  Delete,
  Info,
  Trash2,
  Upload,
  User,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import dayjs from 'dayjs'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'

import {
  deleteVendorPricingOverride,
  getVendorPricingOverrides,
  postVendorPricingSync,
} from '../api'
import type { VendorOfficialPricingEntry } from '../types'
import { ConfirmDialog } from '@/components/confirm-dialog'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type VendorPricingSyncSectionProps = {}

export function VendorPricingSyncSection({}: VendorPricingSyncSectionProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [jsonInput, setJsonInput] = useState('')
  const [replaceAll, setReplaceAll] = useState(false)
  const [sourceNote, setSourceNote] = useState('')
  const [deleteModelName, setDeleteModelName] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vendor-pricing-overrides'],
    queryFn: getVendorPricingOverrides,
  })

  const syncMutation = useMutation({
    mutationFn: () => {
      let parsedEntries: Record<string, VendorOfficialPricingEntry>
      try {
        parsedEntries = JSON.parse(jsonInput)
      } catch (e) {
        throw new Error(t('Invalid JSON format. Please check your input.'))
      }

      if (typeof parsedEntries !== 'object' || parsedEntries === null) {
        throw new Error(t('Expected a JSON object mapping model names to pricing entries'))
      }

      return postVendorPricingSync({
        entries: parsedEntries,
        replace_all: replaceAll,
        source_note: sourceNote.trim() || undefined,
      })
    },
    onSuccess: (data) => {
      if (data.success && data.result) {
        const { merged_count, replaced_count, unchanged_count, deleted_count } = data.result
        const messages: string[] = []

        if (merged_count > 0) {
          messages.push(t('{{count}} entry(s) merged', { count: merged_count }))
        }
        if (replaced_count > 0) {
          messages.push(t('{{count}} entry(s) updated', { count: replaced_count }))
        }
        if (unchanged_count > 0) {
          messages.push(t('{{count}} entry(s) unchanged', { count: unchanged_count }))
        }
        if (deleted_count > 0) {
          messages.push(t('{{count}} entry(s) deleted', { count: deleted_count }))
        }

        const summary = messages.join(', ')
        if (merged_count === 0 && deleted_count === 0) {
          toast.info(t('No changes applied: {{summary}}', { summary }))
        } else {
          toast.success(t('Sync completed: {{summary}}', { summary }))
        }

        queryClient.invalidateQueries({ queryKey: ['vendor-pricing-overrides'] })
        // Keep input for reference, don't clear unless user wants to
      } else {
        toast.error(data.message || t('Sync failed'))
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || t('Sync failed'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (modelName: string) => {
      const response = await deleteVendorPricingOverride(modelName)
      if (!response.success) {
        throw new Error(t('Delete failed'))
      }
      return response
    },
    onSuccess: () => {
      toast.success(t('Override deleted successfully'))
      queryClient.invalidateQueries({ queryKey: ['vendor-pricing-overrides'] })
      setDeleteModelName(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || t('Delete failed'))
    },
  })

  const entries = data?.entries || {}
  const entryCount = Object.keys(entries).length

  const handleSync = () => {
    syncMutation.mutate()
  }

  const handleDelete = (modelName: string) => {
    setDeleteModelName(modelName)
  }

  const confirmDelete = () => {
    if (deleteModelName) {
      deleteMutation.mutate(deleteModelName)
    }
  }

  const formatPricingValue = (value: number | undefined): string => {
    if (value === undefined) return '-'
    return value.toFixed(6)
  }

  const getKindLabel = (kind: string): string => {
    const labels: Record<string, string> = {
      'chat': 'Chat',
      'multimodal-chat': 'Multimodal Chat',
      'image-gen': 'Image Generation',
      'video-gen': 'Video Generation',
      'audio-in': 'Audio Transcription',
      'audio-out': 'Audio Synthesis',
      'embedding': 'Embedding',
    }
    return labels[kind] || kind
  }

  const hasExtraMultipliers = (entry: VendorOfficialPricingEntry): boolean => {
    return !!(
      (entry.quality_multipliers && Object.keys(entry.quality_multipliers).length > 0) ||
      (entry.size_multipliers && Object.keys(entry.size_multipliers).length > 0) ||
      (entry.resolution_multipliers && Object.keys(entry.resolution_multipliers).length > 0) ||
      (entry.voice_multipliers && Object.keys(entry.voice_multipliers).length > 0)
    )
  }

  const isLoadingOverall = isLoading || syncMutation.isPending || deleteMutation.isPending

  return (
    <div className='space-y-6'>
      <Alert>
        <Info className='h-4 w-4' />
        <AlertTitle>{t('Vendor Official Pricing Sync')}</AlertTitle>
        <AlertDescription>
          {t(
            'This page lets you override the compiled-in vendor pricing baseline at runtime without restarting the server. Useful when a vendor changes prices unexpectedly (e.g., Doubao/Volcano Engine).'
          )}
        </AlertDescription>
      </Alert>

      {/* Sync Input Card */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Upload className='h-5 w-5' />
            {t('Import Pricing Entries')}
          </CardTitle>
          <CardDescription>
            {t('Paste JSON formatted pricing data from the vendor console')}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='json-input'>{t('JSON Input')}</Label>
            <Textarea
              id='json-input'
              placeholder={t(
                'Example:\n{\n  "doubao-seedream-5-0-pro-260628": {\n    "kind": "chat",\n    "input_per_million_tokens": 0.08,\n    "output_per_million_tokens": 0.16,\n    "vendor": "doubao"\n  }\n}'
              )}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              className='min-h-[200px] font-mono text-sm'
              disabled={isLoadingOverall}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='source-note'>{t('Source Note (optional)')}</Label>
            <Input
              id='source-note'
              placeholder={t('e.g., Doubao console 2026-07-15')}
              value={sourceNote}
              onChange={(e) => setSourceNote(e.target.value)}
              disabled={isLoadingOverall}
            />
          </div>

          <div className='flex items-center space-x-2'>
            <Checkbox
              id='replace-all'
              checked={replaceAll}
              onCheckedChange={(checked) => setReplaceAll(checked === true)}
              disabled={isLoadingOverall}
            />
            <Label
              htmlFor='replace-all'
              className='text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
            >
              {t('Replace all existing overrides (delete anything not in the input)')}
            </Label>
          </div>

          <div className='flex items-center justify-end gap-2'>
            <Button
              variant='secondary'
              onClick={() => refetch()}
              disabled={isLoadingOverall}
            >
              <ArrowDownUp className='mr-2 h-4 w-4' />
              {t('Refresh')}
            </Button>
            <Button
              onClick={handleSync}
              disabled={isLoadingOverall || !jsonInput.trim()}
            >
              {syncMutation.isPending && (
                <span className='mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent' />
              )}
              <Upload className='mr-2 h-4 w-4' />
              {t('Sync')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Overrides Card */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center justify-between'>
            <span className='flex items-center gap-2'>
              <Trash2 className='h-5 w-5' />
              {t('Current Overrides')}
            </span>
            <Badge variant='secondary'>{entryCount}</Badge>
          </CardTitle>
          <CardDescription>
            {t('These runtime entries override the static baseline compiled into the binary')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='py-8 text-center text-muted-foreground'>
              {t('Loading...')}
            </div>
          ) : entryCount === 0 ? (
            <div className='py-8 text-center text-muted-foreground'>
              {t('No vendor pricing overrides configured yet')}
            </div>
          ) : (
            <ScrollArea className='max-h-[500px]'>
              <div className='space-y-3'>
                {Object.entries(entries).map(([modelName, entry]) => (
                  <Card key={modelName} className='overflow-hidden'>
                    <div className='flex items-start justify-between p-4'>
                      <div className='space-y-1 min-w-0 flex-1'>
                        <div className='flex items-center gap-2 flex-wrap'>
                          <h4 className='font-medium text-sm truncate'>{modelName}</h4>
                          <Badge variant='outline' className='shrink-0'>
                            {getKindLabel(entry.kind)}
                          </Badge>
                          {entry.vendor && (
                            <Badge variant='secondary' className='shrink-0'>
                              {entry.vendor}
                            </Badge>
                          )}
                        </div>

                        <div className='grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2'>
                          {entry.input_per_million_tokens !== undefined && (
                            <div>
                              <span className='font-medium'>{t('Input/M')}:</span>{' '}
                              {formatPricingValue(entry.input_per_million_tokens)}
                            </div>
                          )}
                          {entry.output_per_million_tokens !== undefined && (
                            <div>
                              <span className='font-medium'>{t('Output/M')}:</span>{' '}
                              {formatPricingValue(entry.output_per_million_tokens)}
                            </div>
                          )}
                          {entry.price_per_image !== undefined && (
                            <div>
                              <span className='font-medium'>{t('Price/Image')}:</span>{' '}
                              {formatPricingValue(entry.price_per_image)}
                            </div>
                          )}
                          {entry.price_per_second !== undefined && (
                            <div>
                              <span className='font-medium'>{t('Price/Second')}:</span>{' '}
                              {formatPricingValue(entry.price_per_second)}
                            </div>
                          )}
                          {entry.price_per_minute !== undefined && (
                            <div>
                              <span className='font-medium'>{t('Price/Minute')}:</span>{' '}
                              {formatPricingValue(entry.price_per_minute)}
                            </div>
                          )}
                          {entry.price_per_million_chars !== undefined && (
                            <div>
                              <span className='font-medium'>{t('Price/M Chars')}:</span>{' '}
                              {formatPricingValue(entry.price_per_million_chars)}
                            </div>
                          )}
                        </div>

                        {hasExtraMultipliers(entry) && (
                          <div className='mt-2 flex flex-wrap gap-1'>
                            {entry.quality_multipliers && Object.keys(entry.quality_multipliers).length > 0 && (
                              <Badge variant='outline' className='text-xs'>
                                {Object.keys(entry.quality_multipliers).length} {t('quality multipliers')}
                              </Badge>
                            )}
                            {entry.size_multipliers && Object.keys(entry.size_multipliers).length > 0 && (
                              <Badge variant='outline' className='text-xs'>
                                {Object.keys(entry.size_multipliers).length} {t('size multipliers')}
                              </Badge>
                            )}
                            {entry.resolution_multipliers && Object.keys(entry.resolution_multipliers).length > 0 && (
                              <Badge variant='outline' className='text-xs'>
                                {Object.keys(entry.resolution_multipliers).length} {t('resolution multipliers')}
                              </Badge>
                            )}
                            {entry.voice_multipliers && Object.keys(entry.voice_multipliers).length > 0 && (
                              <Badge variant='outline' className='text-xs'>
                                {Object.keys(entry.voice_multipliers).length} {t('voice multipliers')}
                              </Badge>
                            )}
                          </div>
                        )}

                        {(entry.updated_at || entry.updated_by) && (
                          <div className='flex items-center gap-3 mt-2 text-xs text-muted-foreground'>
                            {entry.updated_at && (
                              <span className='flex items-center gap-1'>
                                <Calendar className='h-3 w-3' />
                                {dayjs.unix(entry.updated_at).format('YYYY-MM-DD HH:mm')}
                              </span>
                            )}
                            {entry.updated_by && (
                              <span className='flex items-center gap-1'>
                                <User className='h-3 w-3' />
                                {t('Admin #{{id}}', { id: entry.updated_by })}
                              </span>
                            )}
                          </div>
                        )}

                        {entry.source_notes && (
                          <div className='mt-1 text-xs text-muted-foreground'>
                            <span className='font-medium'>{t('Source')}:</span> {entry.source_notes}
                          </div>
                        )}
                      </div>

                      <Button
                        variant='destructive'
                        size='sm'
                        className='ml-4 shrink-0'
                        onClick={() => handleDelete(modelName)}
                        disabled={isLoadingOverall}
                      >
                        <Delete className='h-4 w-4' />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteModelName}
        onOpenChange={() => setDeleteModelName(null)}
        title={t('Delete this override?')}
        desc={t(
          'This will remove the runtime override for "{{modelName}}". The model will fall back to the static compiled-in baseline.',
          { modelName: deleteModelName || '' }
        )}
        destructive
        isLoading={deleteMutation.isPending}
        handleConfirm={confirmDelete}
        confirmText={t('Delete')}
      />
    </div>
  )
}
