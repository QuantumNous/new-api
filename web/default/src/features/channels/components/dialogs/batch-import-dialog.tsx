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
import { useState, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileUp,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { createChannel } from '../../api'
import { channelsQueryKeys } from '../../lib'

// ============================================================================
// Types
// ============================================================================

interface ParsedEntry {
  balance: number
  key: string
  name: string
  lineNumber: number
}

interface ImportResult {
  entry: ParsedEntry
  success: boolean
  error?: string
}

type ImportState = 'idle' | 'importing' | 'done'

// ============================================================================
// Constants
// ============================================================================

const ANTHROPIC_CHANNEL_TYPE = 14
const DEFAULT_MODELS =
  'claude-sonnet-4-20250514,claude-opus-4-20250514,claude-3-7-sonnet-20250219,claude-3-5-sonnet-20241022,claude-3-5-haiku-20241022'
const DEFAULT_GROUP = 'default'

// ============================================================================
// Helpers
// ============================================================================

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function generateTimestamp(): string {
  const now = new Date()
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`
}

function generateChannelName(
  balance: number,
  suffix: string,
  timestamp: string
): string {
  return `${timestamp}-${balance}-${suffix}`
}

function parseBatchInput(
  text: string,
  suffix: string,
  timestamp: string
): { entries: ParsedEntry[]; errors: string[] } {
  const lines = text.split('\n')
  const entries: ParsedEntry[] = []
  const errors: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Support both tab and multi-space separation
    const parts = line.split(/\t+|\s{2,}/)
    if (parts.length < 2) {
      errors.push(`Line ${i + 1}: Expected format "balance<Tab>key", got "${line.substring(0, 50)}"`)
      continue
    }

    const balanceStr = parts[0].trim()
    const key = parts.slice(1).join('').trim()

    const balance = Number(balanceStr)
    if (isNaN(balance)) {
      errors.push(`Line ${i + 1}: Invalid balance "${balanceStr}"`)
      continue
    }

    if (!key) {
      errors.push(`Line ${i + 1}: Empty key`)
      continue
    }

    entries.push({
      balance,
      key,
      name: generateChannelName(balance, suffix, timestamp),
      lineNumber: i + 1,
    })
  }

  return { entries, errors }
}

// ============================================================================
// Component
// ============================================================================

type BatchImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BatchImportDialog({
  open,
  onOpenChange,
}: BatchImportDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  // Form state
  const [inputText, setInputText] = useState('')
  const [nameSuffix, setNameSuffix] = useState('')
  const [models, setModels] = useState(DEFAULT_MODELS)
  const [group, setGroup] = useState(DEFAULT_GROUP)

  // Import state
  const [importState, setImportState] = useState<ImportState>('idle')
  const [results, setResults] = useState<ImportResult[]>([])
  const [progress, setProgress] = useState(0)

  // Generate timestamp once for preview consistency
  const timestamp = useMemo(() => generateTimestamp(), [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Parse input for preview
  const parsed = useMemo(() => {
    if (!inputText.trim() || !nameSuffix.trim()) {
      return { entries: [], errors: [] }
    }
    return parseBatchInput(inputText, nameSuffix.trim(), timestamp)
  }, [inputText, nameSuffix, timestamp])

  // Reset state when dialog opens/closes
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        // Only reset if not currently importing
        if (importState !== 'importing') {
          setInputText('')
          setNameSuffix('')
          setModels(DEFAULT_MODELS)
          setGroup(DEFAULT_GROUP)
          setImportState('idle')
          setResults([])
          setProgress(0)
        }
      }
      onOpenChange(isOpen)
    },
    [importState, onOpenChange]
  )

  // Execute import
  const handleImport = useCallback(async () => {
    if (parsed.entries.length === 0) return

    setImportState('importing')
    setResults([])
    setProgress(0)

    const importResults: ImportResult[] = []
    const total = parsed.entries.length

    // Use sequential requests to avoid overwhelming the server
    for (let i = 0; i < total; i++) {
      const entry = parsed.entries[i]
      try {
        const res = await createChannel({
          mode: 'single',
          channel: {
            name: entry.name,
            type: ANTHROPIC_CHANNEL_TYPE,
            key: entry.key,
            models: models,
            group: group,
            balance: entry.balance,
            status: 1,
            auto_ban: 1,
            weight: 0,
            priority: 0,
          },
        })

        if (res.success) {
          importResults.push({ entry, success: true })
        } else {
          importResults.push({
            entry,
            success: false,
            error: res.message || 'Unknown error',
          })
        }
      } catch (err) {
        importResults.push({
          entry,
          success: false,
          error: err instanceof Error ? err.message : 'Network error',
        })
      }

      setProgress(i + 1)
      setResults([...importResults])
    }

    setImportState('done')

    const successCount = importResults.filter((r) => r.success).length
    const failCount = importResults.filter((r) => !r.success).length

    if (failCount === 0) {
      toast.success(
        t('Successfully imported {{count}} channels', { count: successCount })
      )
    } else {
      toast.warning(
        t('Imported {{success}} channels, {{fail}} failed', {
          success: successCount,
          fail: failCount,
        })
      )
    }

    // Refresh channel list
    queryClient.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
  }, [parsed.entries, models, group, queryClient, t])

  const canImport =
    importState === 'idle' &&
    parsed.entries.length > 0 &&
    parsed.errors.length === 0 &&
    nameSuffix.trim().length > 0

  const successCount = results.filter((r) => r.success).length
  const failCount = results.filter((r) => !r.success).length

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-[680px] max-h-[85vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <FileUp className='h-5 w-5' />
            {t('Batch Import Claude Channels')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'Paste balance and key data (tab-separated), one entry per line. Channels will be created as Anthropic Claude (type 14).'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          {/* Name Suffix */}
          <div className='space-y-2'>
            <Label htmlFor='batch-import-suffix'>{t('Name Tag')}</Label>
            <Input
              id='batch-import-suffix'
              placeholder={t('e.g., liz')}
              value={nameSuffix}
              onChange={(e) => setNameSuffix(e.target.value)}
              disabled={importState !== 'idle'}
            />
            <p className='text-muted-foreground text-xs'>
              {t('Channel name format: {{format}}', {
                format: `${timestamp}-{balance}-{tag}`,
              })}
            </p>
          </div>



          {/* Group */}
          <div className='space-y-2'>
            <Label htmlFor='batch-import-group'>{t('Group')}</Label>
            <Input
              id='batch-import-group'
              placeholder='default'
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              disabled={importState !== 'idle'}
            />
          </div>

          {/* Input Data */}
          <div className='space-y-2'>
            <Label htmlFor='batch-import-data'>
              {t('Import Data')}
              <span className='text-muted-foreground ml-2 text-xs font-normal'>
                ({t('balance<Tab>key, one per line')})
              </span>
            </Label>
            <Textarea
              id='batch-import-data'
              placeholder={`139\tsk-ant-api03-xxxxx...\n114\tsk-ant-api03-yyyyy...`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={importState !== 'idle'}
              rows={6}
              className='font-mono text-xs'
            />
          </div>

          {/* Parse Errors */}
          {parsed.errors.length > 0 && (
            <div className='rounded-md border border-destructive/50 bg-destructive/10 p-3'>
              <div className='flex items-center gap-2 text-sm font-medium text-destructive'>
                <AlertTriangle className='h-4 w-4' />
                {t('Parse Errors')}
              </div>
              <ul className='mt-1 space-y-0.5 text-xs text-destructive'>
                {parsed.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Preview Table */}
          {parsed.entries.length > 0 && (
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <Label>{t('Preview')}</Label>
                <span className='text-muted-foreground text-xs'>
                  {t('{{count}} entries', { count: parsed.entries.length })}
                </span>
              </div>
              <div className='rounded-md border'>
                <div className='max-h-[200px] overflow-y-auto'>
                  <table className='w-full text-xs'>
                    <thead className='bg-muted/50 sticky top-0'>
                      <tr>
                        <th className='px-3 py-1.5 text-left font-medium'>
                          #
                        </th>
                        <th className='px-3 py-1.5 text-left font-medium'>
                          {t('Channel Name')}
                        </th>
                        <th className='px-3 py-1.5 text-right font-medium'>
                          {t('Balance')}
                        </th>
                        <th className='px-3 py-1.5 text-left font-medium'>
                          {t('Key Prefix')}
                        </th>
                        {importState !== 'idle' && (
                          <th className='px-3 py-1.5 text-center font-medium'>
                            {t('Status')}
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className='divide-y'>
                      {parsed.entries.map((entry, idx) => {
                        const result = results[idx]
                        return (
                          <tr
                            key={idx}
                            className={
                              result
                                ? result.success
                                  ? 'bg-green-50 dark:bg-green-950/20'
                                  : 'bg-red-50 dark:bg-red-950/20'
                                : ''
                            }
                          >
                            <td className='px-3 py-1.5 text-muted-foreground'>
                              {idx + 1}
                            </td>
                            <td className='px-3 py-1.5 font-mono'>
                              {entry.name}
                            </td>
                            <td className='px-3 py-1.5 text-right tabular-nums'>
                              ${entry.balance}
                            </td>
                            <td className='text-muted-foreground px-3 py-1.5 font-mono'>
                              {entry.key.substring(0, 16)}...
                            </td>
                            {importState !== 'idle' && (
                              <td className='px-3 py-1.5 text-center'>
                                {result ? (
                                  result.success ? (
                                    <CheckCircle2 className='mx-auto h-4 w-4 text-green-500' />
                                  ) : (
                                    <span title={result.error}>
                                      <XCircle className='mx-auto h-4 w-4 text-red-500' />
                                    </span>
                                  )
                                ) : idx < progress ? (
                                  <Loader2 className='mx-auto h-4 w-4 animate-spin' />
                                ) : (
                                  <span className='text-muted-foreground'>
                                    —
                                  </span>
                                )}
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Progress bar during import */}
          {importState === 'importing' && (
            <div className='space-y-1'>
              <div className='flex justify-between text-xs text-muted-foreground'>
                <span>
                  {t('Importing...')} {progress}/{parsed.entries.length}
                </span>
                <span>
                  {Math.round((progress / parsed.entries.length) * 100)}%
                </span>
              </div>
              <div className='h-2 w-full rounded-full bg-muted'>
                <div
                  className='h-full rounded-full bg-primary transition-all duration-300'
                  style={{
                    width: `${(progress / parsed.entries.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Results summary */}
          {importState === 'done' && (
            <div className='rounded-md border bg-muted/30 p-3 text-sm'>
              <div className='flex items-center gap-4'>
                <span className='flex items-center gap-1 text-green-600'>
                  <CheckCircle2 className='h-4 w-4' />
                  {t('{{count}} succeeded', { count: successCount })}
                </span>
                {failCount > 0 && (
                  <span className='flex items-center gap-1 text-red-600'>
                    <XCircle className='h-4 w-4' />
                    {t('{{count}} failed', { count: failCount })}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => handleOpenChange(false)}
            disabled={importState === 'importing'}
          >
            {importState === 'done' ? t('Close') : t('Cancel')}
          </Button>
          {importState !== 'done' && (
            <Button
              onClick={handleImport}
              disabled={!canImport || importState === 'importing'}
            >
              {importState === 'importing' && (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              )}
              {importState === 'importing'
                ? t('Importing...')
                : t('Import ({{count}} entries)', {
                    count: parsed.entries.length,
                  })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
