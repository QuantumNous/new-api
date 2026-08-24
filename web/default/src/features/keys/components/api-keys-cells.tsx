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
import { useState, useCallback, useMemo } from 'react'
import { Check, Copy, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { StatusBadge } from '@/components/status-badge'
import { getApiKeyModelScopeSummary } from '../lib/api-key-model-scope'
import { type ApiKey } from '../types'
import { ApiKeyModelScopeSheet } from './api-key-model-scope-sheet'
import { useApiKeys } from './api-keys-provider'

export function ApiKeyCell({ apiKey }: { apiKey: ApiKey }) {
  const { t } = useTranslation()
  const {
    resolveRealKey,
    resolvedKeys,
    loadingKeys,
    copiedKeyId,
    markKeyCopied,
  } = useApiKeys()
  const [popoverOpen, setPopoverOpen] = useState(false)

  const isLoading = !!loadingKeys[apiKey.id]
  const resolvedFullKey = resolvedKeys[apiKey.id]
  const isCopied = copiedKeyId === apiKey.id
  const maskedKey = `sk-${apiKey.key}`

  const handlePopoverOpen = useCallback(
    (open: boolean) => {
      setPopoverOpen(open)
      if (open && !resolvedFullKey) {
        resolveRealKey(apiKey.id)
      }
    },
    [resolvedFullKey, resolveRealKey, apiKey.id]
  )

  const handleCopy = useCallback(async () => {
    const realKey = resolvedFullKey
    if (!realKey) {
      void resolveRealKey(apiKey.id)
      toast.info(t('API key is loading, please try again in a moment'))
      return
    }
    if (realKey) {
      const ok = await copyToClipboard(realKey)
      if (ok) markKeyCopied(apiKey.id)
    }
  }, [resolvedFullKey, resolveRealKey, apiKey.id, markKeyCopied, t])

  return (
    <div className='flex items-center'>
      <Popover open={popoverOpen} onOpenChange={handlePopoverOpen}>
        <PopoverTrigger
          render={
            <Button
              variant='ghost'
              size='sm'
              className='text-muted-foreground h-7 font-mono text-xs'
            />
          }
        >
          {maskedKey}
        </PopoverTrigger>
        <PopoverContent
          className='w-auto max-w-[min(90vw,28rem)]'
          align='start'
        >
          <div className='space-y-2'>
            <p className='text-muted-foreground text-xs'>{t('Full API Key')}</p>
            {isLoading ? (
              <div className='flex items-center gap-2 py-2'>
                <Loader2 className='size-3.5 animate-spin' />
                <span className='text-muted-foreground text-xs'>
                  {t('Loading...')}
                </span>
              </div>
            ) : (
              <input
                readOnly
                value={resolvedFullKey || maskedKey}
                autoFocus
                onFocus={(e) => e.target.select()}
                className='bg-muted/50 w-full min-w-[280px] rounded-md border px-3 py-2 font-mono text-xs outline-none'
              />
            )}
          </div>
        </PopoverContent>
      </Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant='ghost'
              size='icon'
              className='size-7 shrink-0'
              onClick={handleCopy}
              onFocus={() => {
                if (!resolvedFullKey) void resolveRealKey(apiKey.id)
              }}
              onPointerEnter={() => {
                if (!resolvedFullKey) void resolveRealKey(apiKey.id)
              }}
              disabled={isLoading}
            />
          }
        >
          {isLoading ? (
            <Loader2 className='size-3.5 animate-spin' />
          ) : isCopied ? (
            <Check className='size-3.5 text-green-600' />
          ) : (
            <Copy className='size-3.5' />
          )}
        </TooltipTrigger>
        <TooltipContent>
          {isLoading
            ? t('Loading...')
            : isCopied
              ? t('Copied!')
              : t('Copy API key')}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

export function ModelLimitsCell({ apiKey }: { apiKey: ApiKey }) {
  const { t } = useTranslation()
  const { modelAccessQuery } = useApiKeys()
  const [scopeOpen, setScopeOpen] = useState(false)
  const summary = useMemo(
    () =>
      modelAccessQuery.data
        ? getApiKeyModelScopeSummary(modelAccessQuery.data, apiKey)
        : null,
    [apiKey, modelAccessQuery.data]
  )

  if (modelAccessQuery.isPending) {
    return <Skeleton className='h-5 w-28' />
  }

  if (!summary) {
    return (
      <StatusBadge
        label={t('Unable to load available models')}
        variant='warning'
        copyable={false}
      />
    )
  }

  let label: string
  if (summary.labelKind === 'empty') {
    label = t('0 callable')
  } else if (summary.labelKind === 'limited') {
    label = t('{{effective}} / {{total}} models', {
      effective: summary.effectiveModels.length,
      total: summary.totalModels.length,
    })
  } else if (summary.labelKind === 'all-account') {
    label = t('All in account · {{count}}', {
      count: summary.totalModels.length,
    })
  } else {
    label = t('All in group · {{count}}', {
      count: summary.totalModels.length,
    })
  }

  return (
    <>
      <Button
        type='button'
        variant='ghost'
        size='sm'
        className='h-auto p-0'
        aria-label={t('View callable models for {{name}}', {
          name: apiKey.name,
        })}
        onClick={() => setScopeOpen(true)}
      >
        <StatusBadge label={label} variant='neutral' copyable={false} />
      </Button>
      <ApiKeyModelScopeSheet
        apiKeyName={apiKey.name}
        defaultRatio={summary.defaultRatio}
        models={summary.effectiveModels}
        modelRatios={summary.modelRatios}
        totalCount={summary.totalModels.length}
        open={scopeOpen}
        onOpenChange={setScopeOpen}
      />
    </>
  )
}

export function IpRestrictionsCell({ apiKey }: { apiKey: ApiKey }) {
  const { t } = useTranslation()
  const allowIps = apiKey.allow_ips?.trim()

  if (!allowIps) {
    return (
      <StatusBadge
        label={t('No restriction')}
        variant='neutral'
        copyable={false}
      />
    )
  }

  const ips = allowIps
    .split('\n')
    .map((ip) => ip.trim())
    .filter(Boolean)

  return (
    <Tooltip>
      <TooltipTrigger render={<span />}>
        <StatusBadge
          label={t('{{count}} IP(s)', { count: ips.length })}
          variant='neutral'
          copyable={false}
        />
      </TooltipTrigger>
      <TooltipContent side='top' className='max-w-xs'>
        <div className='max-h-[200px] space-y-0.5 overflow-y-auto text-xs'>
          {ips.map((ip) => (
            <div key={ip} className='font-mono'>
              {ip}
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
