import { useCallback } from 'react'
import { Check, Eye, EyeOff, Copy, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { StatusBadge } from '@/components/status-badge'
import { type ApiKey } from '../types'
import { useApiKeys } from './api-keys-provider'

export function ApiKeyCell({ apiKey }: { apiKey: ApiKey }) {
  const { t } = useTranslation()
  const {
    resolveRealKey,
    toggleKeyVisibility,
    keyVisibility,
    resolvedKeys,
    loadingKeys,
    copiedKeyId,
    markKeyCopied,
  } = useApiKeys()

  const isVisible = !!keyVisibility[apiKey.id]
  const isLoading = !!loadingKeys[apiKey.id]
  const resolvedFullKey = resolvedKeys[apiKey.id]
  const isCopied = copiedKeyId === apiKey.id

  const displayedKey =
    isVisible && resolvedFullKey
      ? resolvedFullKey
      : `sk-${apiKey.key.slice(0, 4)}${'*'.repeat(16)}${apiKey.key.slice(-4)}`

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      const realKey = resolvedFullKey || (await resolveRealKey(apiKey.id))
      if (realKey) {
        const success = await copyToClipboard(realKey)
        if (success) {
          markKeyCopied(apiKey.id)
        }
      }
    },
    [resolvedFullKey, resolveRealKey, apiKey.id, markKeyCopied]
  )

  return (
    <div className='flex items-center gap-0.5'>
      <span
        className={`max-w-[180px] truncate font-mono text-xs ${isVisible ? '' : 'text-muted-foreground'}`}
      >
        {displayedKey}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='ghost'
            size='icon'
            className='size-7 shrink-0'
            disabled={isLoading}
            onClick={(e) => {
              e.stopPropagation()
              toggleKeyVisibility(apiKey.id)
            }}
          >
            {isLoading ? (
              <Loader2 className='size-3.5 animate-spin' />
            ) : isVisible ? (
              <EyeOff className='size-3.5' />
            ) : (
              <Eye className='size-3.5' />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isVisible ? t('Hide API key') : t('Reveal API key')}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='ghost'
            size='icon'
            className='size-7 shrink-0'
            onClick={handleCopy}
          >
            {isCopied ? (
              <Check className='size-3.5 text-green-600' />
            ) : (
              <Copy className='size-3.5' />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isCopied ? t('Copied!') : t('Copy API key')}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

export function ModelLimitsCell({ apiKey }: { apiKey: ApiKey }) {
  const { t } = useTranslation()

  if (!apiKey.model_limits_enabled || !apiKey.model_limits) {
    return (
      <StatusBadge label={t('Unlimited')} variant='neutral' copyable={false} />
    )
  }

  const models = apiKey.model_limits.split(',').filter(Boolean)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className='text-muted-foreground cursor-default text-xs font-medium'>
          {t('{{count}} model(s)', { count: models.length })}
        </span>
      </TooltipTrigger>
      <TooltipContent side='top' className='max-w-xs'>
        <div className='max-h-[200px] space-y-0.5 overflow-y-auto text-xs'>
          {models.map((m) => (
            <div key={m} className='font-mono'>
              {m}
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
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
      <TooltipTrigger asChild>
        <span className='text-muted-foreground cursor-default text-xs font-medium'>
          {t('{{count}} IP(s)', { count: ips.length })}
        </span>
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
