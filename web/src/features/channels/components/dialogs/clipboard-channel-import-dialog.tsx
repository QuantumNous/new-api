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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  ClipboardPaste,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react'
import { nanoid } from 'nanoid'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  maskChannelKey,
  parseChannelConnectionInfos,
  type ChannelConnectionConfidence,
} from '@/lib/channel-connection-info'

import {
  importClipboardChannels,
  rollbackClipboardChannelImport,
} from '../../api'
import { CHANNEL_TYPE_OPTIONS } from '../../constants'
import { channelsQueryKeys } from '../../lib'
import type {
  ClipboardChannelImportRequest,
  ClipboardChannelImportResult,
  ClipboardChannelImportStatus,
} from '../../types'

type ClipboardChannelImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialText: string
  onClearSensitiveText: () => void
}

type ClipboardImportDraftItem = {
  itemId: string
  name: string
  baseUrl: string
  keys: string[]
  confidence: ChannelConnectionConfidence
}

type ClipboardImportPreferences = {
  namePrefix: string
  channelType: string
  group: string
  tag: string
  models: string
  keyMode: 'random' | 'polling'
  expiresInSeconds: string
  probeModels: boolean
}

const CLIPBOARD_IMPORT_PREFERENCES_KEY = 'channels:clipboard-import-preferences'
const DEFAULT_IMPORT_PREFERENCES: ClipboardImportPreferences = {
  namePrefix: 'Temporary',
  channelType: '1',
  group: 'default',
  tag: 'clipboard-import',
  models: '',
  keyMode: 'random',
  expiresInSeconds: '86400',
  probeModels: true,
}
const EXPIRATION_OPTIONS = [
  { value: '3600', labelKey: '1 hour' },
  { value: '86400', labelKey: '24 hours' },
  { value: '604800', labelKey: '7 days' },
  { value: '0', labelKey: 'Never expires' },
] as const

function readImportPreferences(): ClipboardImportPreferences {
  if (typeof window === 'undefined') return DEFAULT_IMPORT_PREFERENCES
  try {
    const raw = window.localStorage.getItem(CLIPBOARD_IMPORT_PREFERENCES_KEY)
    if (!raw) return DEFAULT_IMPORT_PREFERENCES
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return DEFAULT_IMPORT_PREFERENCES
    return {
      ...DEFAULT_IMPORT_PREFERENCES,
      ...(parsed as Partial<ClipboardImportPreferences>),
    }
  } catch {
    return DEFAULT_IMPORT_PREFERENCES
  }
}

function writeImportPreferences(preferences: ClipboardImportPreferences): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    CLIPBOARD_IMPORT_PREFERENCES_KEY,
    JSON.stringify(preferences)
  )
}

function statusBadgeVariant(
  status: ClipboardChannelImportStatus
): 'default' | 'warning' | 'destructive' | 'outline' | 'secondary' {
  if (status === 'created') return 'default'
  if (status === 'needs_configuration') return 'warning'
  if (status === 'failed') return 'destructive'
  if (status === 'existing') return 'secondary'
  return 'outline'
}

function statusLabelKey(status: ClipboardChannelImportStatus): string {
  switch (status) {
    case 'created':
      return 'Created and verified'
    case 'existing':
      return 'Already imported'
    case 'duplicate':
      return 'Duplicate skipped'
    case 'needs_configuration':
      return 'Needs configuration'
    default:
      return 'Failed'
  }
}

function getUrlHostname(value: string): string {
  try {
    return new URL(value).hostname
  } catch {
    return value
  }
}

export function ClipboardChannelImportDialog(
  props: ClipboardChannelImportDialogProps
) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [rawText, setRawText] = useState('')
  const [showRawEditor, setShowRawEditor] = useState(false)
  const [ignoreUnmatched, setIgnoreUnmatched] = useState(false)
  const [items, setItems] = useState<ClipboardImportDraftItem[]>([])
  const [batchId, setBatchId] = useState(() => nanoid())
  const [preferences, setPreferences] = useState(readImportPreferences)
  const [results, setResults] = useState<ClipboardChannelImportResult[] | null>(
    null
  )

  const parseResult = useMemo(
    () => parseChannelConnectionInfos(rawText),
    [rawText]
  )
  const hasUnmatched =
    parseResult.unmatchedKeys.length > 0 || parseResult.unmatchedUrls.length > 0

  useEffect(() => {
    if (!props.open) return
    setRawText(props.initialText)
    setShowRawEditor(!props.initialText.trim())
    setIgnoreUnmatched(false)
    setBatchId(nanoid())
    setResults(null)
  }, [props.initialText, props.open])

  useEffect(() => {
    if (!props.open) return
    setItems(
      parseResult.groups.map((group) => ({
        itemId: nanoid(),
        name: '',
        baseUrl: group.url,
        keys: group.keys,
        confidence: group.confidence,
      }))
    )
    setIgnoreUnmatched(false)
    setResults(null)
  }, [parseResult.groups, props.open])

  const importMutation = useMutation({
    mutationFn: async (request: ClipboardChannelImportRequest) => {
      const response = await importClipboardChannels(request)
      if (!response.success || !response.data) {
        throw new Error(response.message || t('Channel import failed'))
      }
      return response.data
    },
    onSuccess: async (data) => {
      // A retry only re-submits problem items, so merge its results into the
      // previous batch view instead of dropping the already-imported rows.
      setResults((current) => {
        if (!current) return data.results
        const byItem = new Map(current.map((r) => [r.item_id, r]))
        for (const r of data.results) byItem.set(r.item_id, r)
        return [...byItem.values()]
      })
      await queryClient.invalidateQueries({ queryKey: channelsQueryKeys.all })
      const readyCount = data.summary.created + data.summary.existing
      if (readyCount > 0) {
        toast.success(
          t('Imported {{count}} ready channels', { count: readyCount })
        )
      }
      if (data.summary.needs_configuration > 0 || data.summary.failed > 0) {
        toast.warning(t('Some channels need attention'))
      }
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : t('Channel import failed')
      )
    },
  })

  const rollbackMutation = useMutation({
    mutationFn: () => rollbackClipboardChannelImport(batchId),
    onSuccess: async (response) => {
      if (!response.success) {
        throw new Error(response.message || t('Rollback failed'))
      }
      await queryClient.invalidateQueries({ queryKey: channelsQueryKeys.all })
      toast.success(
        t('Rolled back {{count}} imported channels', {
          count: response.data ?? 0,
        })
      )
      setResults(null)
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : t('Rollback failed'))
    },
  })

  const createRequest = (
    targetItems: ClipboardImportDraftItem[],
    retryUnverified: boolean
  ): ClipboardChannelImportRequest => ({
    batch_id: batchId,
    name_prefix: preferences.namePrefix.trim(),
    type: Number(preferences.channelType),
    group: preferences.group.trim(),
    tag: preferences.tag.trim(),
    models: preferences.models
      .split(/[\n,]/)
      .map((model) => model.trim())
      .filter(Boolean),
    multi_key_mode: preferences.keyMode,
    expires_in_seconds: Number(preferences.expiresInSeconds),
    probe_models: preferences.probeModels,
    retry_unverified: retryUnverified,
    items: targetItems.map((item) => ({
      item_id: item.itemId,
      name: item.name.trim() || undefined,
      base_url: item.baseUrl.trim(),
      keys: item.keys,
    })),
  })

  const handleImport = () => {
    writeImportPreferences(preferences)
    importMutation.mutate(createRequest(items, false))
  }

  const handleRetry = () => {
    if (!results) return
    const retryItemIDs = new Set(
      results
        .filter(
          (result) =>
            result.status === 'failed' ||
            result.status === 'needs_configuration'
        )
        .map((result) => result.item_id)
    )
    const retryItems = items.filter((item) => retryItemIDs.has(item.itemId))
    if (retryItems.length > 0) {
      importMutation.mutate(createRequest(retryItems, true))
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setRawText('')
      setItems([])
      setResults(null)
      importMutation.reset()
      rollbackMutation.reset()
      props.onClearSensitiveText()
    }
    props.onOpenChange(open)
  }

  const retryable =
    results?.some(
      (result) =>
        result.status === 'failed' || result.status === 'needs_configuration'
    ) ?? false
  const rollbackAvailable =
    results?.some((result) => Boolean(result.channel_id)) ?? false
  const importDisabled =
    items.length === 0 ||
    (hasUnmatched && !ignoreUnmatched) ||
    importMutation.isPending

  let footer = (
    <>
      <Button variant='outline' onClick={() => handleOpenChange(false)}>
        {t('Cancel')}
      </Button>
      <Button onClick={handleImport} disabled={importDisabled}>
        {importMutation.isPending ? (
          <Loader2 className='h-4 w-4 animate-spin' />
        ) : (
          <ShieldCheck className='h-4 w-4' />
        )}
        {t('Confirm Import')}
      </Button>
    </>
  )
  if (results) {
    footer = (
      <>
        {rollbackAvailable && (
          <Button
            variant='destructive'
            onClick={() => rollbackMutation.mutate()}
            disabled={rollbackMutation.isPending}
          >
            {rollbackMutation.isPending ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <RotateCcw className='h-4 w-4' />
            )}
            {t('Rollback This Import')}
          </Button>
        )}
        {retryable && (
          <Button
            variant='outline'
            onClick={handleRetry}
            disabled={importMutation.isPending}
          >
            <RefreshCw
              className={
                importMutation.isPending ? 'h-4 w-4 animate-spin' : 'h-4 w-4'
              }
            />
            {t('Retry Problem Items')}
          </Button>
        )}
        <Button onClick={() => handleOpenChange(false)}>{t('Done')}</Button>
      </>
    )
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={handleOpenChange}
      title={t('Import Channels from Clipboard')}
      description={t(
        'Paste connection information once, review the detected URL and masked keys, then create verified temporary channels.'
      )}
      contentClassName='sm:max-w-4xl'
      contentHeight='min(68vh, 760px)'
      footer={footer}
    >
      <div className='space-y-5'>
        {!rawText.trim() && (
          <Alert>
            <ClipboardPaste className='h-4 w-4' />
            <AlertDescription>
              {t(
                'Clipboard access was unavailable or empty. Paste the URL and sk- API key text below.'
              )}
            </AlertDescription>
          </Alert>
        )}

        {(showRawEditor || items.length === 0) && !results && (
          <div className='space-y-2'>
            <Label htmlFor='clipboard-import-text'>{t('Clipboard Text')}</Label>
            <Textarea
              id='clipboard-import-text'
              aria-label={t('Clipboard Text')}
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              placeholder={t(
                'Paste text containing an https:// URL and one or more sk- API keys'
              )}
              rows={7}
              spellCheck={false}
              autoComplete='off'
            />
            {items.length > 0 && (
              <Button
                type='button'
                size='sm'
                variant='outline'
                onClick={() => setShowRawEditor(false)}
              >
                <CheckCircle2 className='h-4 w-4' />
                {t('Use Parsed Results')}
              </Button>
            )}
          </div>
        )}

        {hasUnmatched && !results && (
          <Alert variant='destructive'>
            <AlertCircle className='h-4 w-4' />
            <AlertDescription className='space-y-2'>
              <p>
                {t(
                  'Some keys or URLs could not be matched safely. Edit the pasted text or explicitly ignore them.'
                )}
              </p>
              {parseResult.unmatchedKeys.length > 0 && (
                <p className='font-mono text-xs'>
                  {parseResult.unmatchedKeys.map(maskChannelKey).join(', ')}
                </p>
              )}
              {parseResult.unmatchedUrls.length > 0 && (
                <p className='text-xs break-all'>
                  {parseResult.unmatchedUrls.join(', ')}
                </p>
              )}
              <div className='flex items-center gap-2 pt-1'>
                <Switch
                  id='ignore-unmatched-import-items'
                  checked={ignoreUnmatched}
                  onCheckedChange={setIgnoreUnmatched}
                />
                <Label htmlFor='ignore-unmatched-import-items'>
                  {t('Ignore unmatched content')}
                </Label>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {items.length > 0 && !results && (
          <>
            <section
              className='space-y-3'
              aria-labelledby='import-preview-title'
            >
              <div className='flex items-center justify-between gap-3'>
                <div>
                  <h3 id='import-preview-title' className='font-medium'>
                    {t('Import Preview')}
                  </h3>
                  <p className='text-muted-foreground text-xs'>
                    {t('{{count}} URL groups detected', {
                      count: items.length,
                    })}
                  </p>
                </div>
                {!showRawEditor && (
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    onClick={() => setShowRawEditor(true)}
                  >
                    <Pencil className='h-4 w-4' />
                    {t('Edit Pasted Text')}
                  </Button>
                )}
              </div>

              <div className='space-y-3'>
                {items.map((item, index) => (
                  <div
                    key={item.itemId}
                    className='bg-muted/30 space-y-3 rounded-lg border p-3'
                  >
                    <div className='flex items-start justify-between gap-3'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <span className='font-medium'>
                          {t('Channel {{number}}', { number: index + 1 })}
                        </span>
                        <Badge
                          variant={
                            item.confidence === 'high' ? 'secondary' : 'warning'
                          }
                        >
                          {item.confidence === 'high'
                            ? t('High confidence')
                            : t('Needs review')}
                        </Badge>
                        <Badge variant='outline'>
                          {t('{{count}} keys', { count: item.keys.length })}
                        </Badge>
                      </div>
                      <Button
                        type='button'
                        size='icon-sm'
                        variant='ghost'
                        aria-label={t('Remove channel from import')}
                        onClick={() =>
                          setItems((current) =>
                            current.filter(
                              (candidate) => candidate.itemId !== item.itemId
                            )
                          )
                        }
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                    <div className='grid gap-3 sm:grid-cols-2'>
                      <div className='space-y-1.5'>
                        <Label htmlFor={`clipboard-import-name-${item.itemId}`}>
                          {t('Channel Name')}
                        </Label>
                        <Input
                          id={`clipboard-import-name-${item.itemId}`}
                          value={item.name}
                          placeholder={`${preferences.namePrefix} · ${getUrlHostname(item.baseUrl)}`}
                          onChange={(event) =>
                            setItems((current) =>
                              current.map((candidate) =>
                                candidate.itemId === item.itemId
                                  ? { ...candidate, name: event.target.value }
                                  : candidate
                              )
                            )
                          }
                        />
                      </div>
                      <div className='space-y-1.5'>
                        <Label htmlFor={`clipboard-import-url-${item.itemId}`}>
                          {t('Base URL')}
                        </Label>
                        <Input
                          id={`clipboard-import-url-${item.itemId}`}
                          value={item.baseUrl}
                          onChange={(event) =>
                            setItems((current) =>
                              current.map((candidate) =>
                                candidate.itemId === item.itemId
                                  ? {
                                      ...candidate,
                                      baseUrl: event.target.value,
                                    }
                                  : candidate
                              )
                            )
                          }
                        />
                      </div>
                    </div>
                    <div
                      className='flex flex-wrap gap-1.5'
                      aria-label={t('Masked API Keys')}
                    >
                      {item.keys.map((key) => (
                        <code
                          key={key}
                          className='bg-background rounded border px-1.5 py-0.5 text-xs'
                        >
                          {maskChannelKey(key)}
                        </code>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section
              className='space-y-3'
              aria-labelledby='import-settings-title'
            >
              <div>
                <h3 id='import-settings-title' className='font-medium'>
                  {t('Import Settings')}
                </h3>
                <p className='text-muted-foreground text-xs'>
                  {t('Only these non-secret preferences are remembered.')}
                </p>
              </div>
              <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                <div className='space-y-1.5'>
                  <Label htmlFor='clipboard-import-name-prefix'>
                    {t('Name Prefix')}
                  </Label>
                  <Input
                    id='clipboard-import-name-prefix'
                    value={preferences.namePrefix}
                    onChange={(event) =>
                      setPreferences((current) => ({
                        ...current,
                        namePrefix: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className='space-y-1.5'>
                  <Label htmlFor='clipboard-import-channel-type'>
                    {t('Channel Type')}
                  </Label>
                  <Select
                    value={preferences.channelType}
                    onValueChange={(value) =>
                      value &&
                      setPreferences((current) => ({
                        ...current,
                        channelType: value,
                      }))
                    }
                    items={CHANNEL_TYPE_OPTIONS.map((option) => ({
                      value: String(option.value),
                      label: t(option.label),
                    }))}
                  >
                    <SelectTrigger
                      id='clipboard-import-channel-type'
                      className='w-full'
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {CHANNEL_TYPE_OPTIONS.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={String(option.value)}
                          >
                            {t(option.label)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-1.5'>
                  <Label htmlFor='clipboard-import-key-mode'>
                    {t('Key Selection Mode')}
                  </Label>
                  <Select
                    value={preferences.keyMode}
                    onValueChange={(value) => {
                      if (value === 'random' || value === 'polling') {
                        setPreferences((current) => ({
                          ...current,
                          keyMode: value,
                        }))
                      }
                    }}
                    items={[
                      { value: 'random', label: t('Random') },
                      { value: 'polling', label: t('Polling') },
                    ]}
                  >
                    <SelectTrigger
                      id='clipboard-import-key-mode'
                      className='w-full'
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='random'>{t('Random')}</SelectItem>
                      <SelectItem value='polling'>{t('Polling')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-1.5'>
                  <Label htmlFor='clipboard-import-group'>{t('Group')}</Label>
                  <Input
                    id='clipboard-import-group'
                    value={preferences.group}
                    onChange={(event) =>
                      setPreferences((current) => ({
                        ...current,
                        group: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className='space-y-1.5'>
                  <Label htmlFor='clipboard-import-tag'>{t('Tag')}</Label>
                  <Input
                    id='clipboard-import-tag'
                    value={preferences.tag}
                    onChange={(event) =>
                      setPreferences((current) => ({
                        ...current,
                        tag: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className='space-y-1.5'>
                  <Label htmlFor='clipboard-import-expiration'>
                    {t('Temporary Validity')}
                  </Label>
                  <Select
                    value={preferences.expiresInSeconds}
                    onValueChange={(value) =>
                      value &&
                      setPreferences((current) => ({
                        ...current,
                        expiresInSeconds: value,
                      }))
                    }
                    items={EXPIRATION_OPTIONS.map((option) => ({
                      value: option.value,
                      label: t(option.labelKey),
                    }))}
                  >
                    <SelectTrigger
                      id='clipboard-import-expiration'
                      className='w-full'
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPIRATION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='clipboard-import-models'>
                  {t('Models (optional)')}
                </Label>
                <Textarea
                  id='clipboard-import-models'
                  value={preferences.models}
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      models: event.target.value,
                    }))
                  }
                  placeholder={t(
                    'Leave empty to automatically use the upstream model list'
                  )}
                  rows={2}
                />
              </div>
              <div className='flex items-start justify-between gap-4 rounded-lg border p-3'>
                <div>
                  <Label htmlFor='clipboard-import-probe-models'>
                    {t('Verify and fetch models before enabling')}
                  </Label>
                  <p className='text-muted-foreground mt-1 text-xs'>
                    {t(
                      'A lightweight model-list request is used. Failed channels remain disabled and can be retried.'
                    )}
                  </p>
                </div>
                <Switch
                  id='clipboard-import-probe-models'
                  checked={preferences.probeModels}
                  onCheckedChange={(checked) =>
                    setPreferences((current) => ({
                      ...current,
                      probeModels: checked,
                    }))
                  }
                />
              </div>
            </section>
          </>
        )}

        {results && (
          <section className='space-y-3' aria-labelledby='import-results-title'>
            <div>
              <h3 id='import-results-title' className='font-medium'>
                {t('Import Results')}
              </h3>
              <p className='text-muted-foreground text-xs'>
                {t(
                  'Ready channels are enabled. Unverified channels stay disabled.'
                )}
              </p>
            </div>
            <div className='space-y-2'>
              {results.map((result) => {
                const failed =
                  result.status === 'failed' ||
                  result.status === 'needs_configuration'
                return (
                  <div
                    key={result.item_id}
                    className='flex items-start gap-3 rounded-lg border p-3'
                  >
                    {failed ? (
                      <XCircle className='text-destructive mt-0.5 h-5 w-5 shrink-0' />
                    ) : (
                      <CheckCircle2 className='text-success mt-0.5 h-5 w-5 shrink-0' />
                    )}
                    <div className='min-w-0 flex-1 space-y-1'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <span className='font-medium'>
                          {result.name || result.base_url || result.item_id}
                        </span>
                        <Badge variant={statusBadgeVariant(result.status)}>
                          {t(statusLabelKey(result.status))}
                        </Badge>
                      </div>
                      {result.base_url && (
                        <p className='text-muted-foreground truncate text-xs'>
                          {result.base_url}
                        </p>
                      )}
                      <p className='text-xs'>
                        {t('{{count}} imported keys', {
                          count: result.key_count,
                        })}
                        {result.skipped_duplicate_keys
                          ? ` · ${t('{{count}} duplicates skipped', {
                              count: result.skipped_duplicate_keys,
                            })}`
                          : ''}
                        {result.models?.length
                          ? ` · ${t('{{count}} models', {
                              count: result.models.length,
                            })}`
                          : ''}
                      </p>
                      {result.message && (
                        <p className='text-muted-foreground text-xs break-words'>
                          {result.message}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </Dialog>
  )
}
