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
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Check, ChevronDown, Circle, Copy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { getApiKeys, getFullApiKey } from '@/features/keys/api'
import type { ApiKey } from '@/features/keys/types'
import { getPricing } from '@/features/pricing/api'
import { ENDPOINT_TYPES } from '@/features/pricing/constants'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { getUserGroupModels } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { useApiInfo } from '../../hooks/use-status-data'

const SETUP_GUIDE_VISIBILITY_STORAGE_KEY =
  'dashboard_overview_setup_guide_expanded'

function getSavedSetupGuideExpanded(): boolean | null {
  if (typeof window === 'undefined') return null
  const saved = window.localStorage.getItem(SETUP_GUIDE_VISIBILITY_STORAGE_KEY)
  if (saved === 'expanded') return true
  if (saved === 'collapsed') return false
  return null
}

function saveSetupGuideExpanded(expanded: boolean): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    SETUP_GUIDE_VISIBILITY_STORAGE_KEY,
    expanded ? 'expanded' : 'collapsed'
  )
}

function getCurrentOrigin(): string {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

function normalizeEndpoint(sourceUrl?: string): string {
  const fallback = `${getCurrentOrigin()}/v1/chat/completions`
  const trimmed = sourceUrl?.trim()
  if (!trimmed) return fallback

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '')
  if (withoutTrailingSlash.endsWith('/v1/chat/completions')) {
    return withoutTrailingSlash
  }
  if (withoutTrailingSlash.endsWith('/v1')) {
    return `${withoutTrailingSlash}/chat/completions`
  }
  return `${withoutTrailingSlash}/v1/chat/completions`
}

function getPreferredKey(keys: ApiKey[]): ApiKey | null {
  return keys.find((item) => item.status === 1) ?? null
}

function formatDisplayKey(key?: string): string {
  if (!key) return 'sk-...'
  if (key.length <= 14) return key
  return `${key.slice(0, 7)}...${key.slice(-4)}`
}

function buildCurlCommand(args: {
  endpoint: string
  apiKey: string
  model: string
}): string {
  return [
    `curl ${args.endpoint} \\`,
    '  -H "Content-Type: application/json" \\',
    `  -H "Authorization: Bearer ${args.apiKey}" \\`,
    `  -d '{"model":"${args.model}","messages":[{"role":"user","content":"Say hello in one sentence."}]}'`,
  ].join('\n')
}

export function DeveloperSetupGuide() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const { items: apiInfoItems } = useApiInfo()
  const [manualExpanded, setManualExpanded] = useState(
    getSavedSetupGuideExpanded
  )
  const [isCopying, setIsCopying] = useState(false)
  const { copyToClipboard } = useCopyToClipboard({ notify: false })
  const keysQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'api-keys', user?.id],
    queryFn: async () => {
      const result = await getApiKeys({ p: 1, size: 10 })
      if (!result.success) throw new Error('Failed to load API keys')
      return result.data?.items ?? []
    },
    staleTime: 60_000,
  })
  const preferredKey = getPreferredKey(keysQuery.data ?? [])
  const steps = [
    {
      title: t('Create API Key'),
      description: t('Create a key for your app or service'),
      to: '/keys',
      completed: Boolean(preferredKey),
    },
    {
      title: t('Add credits'),
      description: t('Keep enough balance before production traffic'),
      to: '/wallet',
      completed: Number(user?.quota) > 0 || Number(user?.used_quota) > 0,
    },
    {
      title: t('Send a request'),
      description: t('Verify routing with Playground or your client'),
      to: '/playground',
      completed: Number(user?.request_count) > 0,
    },
  ]
  const completedCount = steps.filter((step) => step.completed).length
  const complete = completedCount === steps.length
  const expanded =
    manualExpanded ?? (keysQuery.isSuccess && Boolean(user) && !complete)
  const selectedGroup = preferredKey
    ? preferredKey.group || user?.group || ''
    : ''
  const modelsQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'user-models', user?.id, selectedGroup],
    queryFn: async () => {
      const result = await getUserGroupModels(selectedGroup)
      if (!result.success) throw new Error('Failed to load models')
      return result.data ?? []
    },
    enabled: expanded && Boolean(selectedGroup),
    staleTime: 300_000,
  })
  const pricingQuery = useQuery({
    queryKey: ['pricing'],
    queryFn: getPricing,
    enabled: expanded && Boolean(selectedGroup),
    staleTime: 300_000,
  })
  const endpoint = normalizeEndpoint(apiInfoItems[0]?.url)
  const baseUrl = endpoint.replace(/\/chat\/completions$/, '')
  const model = useMemo(() => {
    const chatModels = new Set(
      (pricingQuery.data?.success ? pricingQuery.data.data : [])
        .filter((item) =>
          item.supported_endpoint_types?.includes(ENDPOINT_TYPES.OPENAI)
        )
        .map((item) => item.model_name)
    )
    const allowedModels = preferredKey?.model_limits_enabled
      ? new Set((preferredKey.model_limits ?? '').split(','))
      : null
    return modelsQuery.data?.find((candidate) => {
      if (!chatModels.has(candidate)) return false
      if (!allowedModels) return true
      // Match middleware/distributor.go's FormatMatchingModelName contract.
      let matchName = candidate
      const thinkingFamily = [
        'gemini-2.5-flash-lite',
        'gemini-2.5-flash',
        'gemini-2.5-pro',
      ].find((prefix) => candidate.startsWith(prefix))
      if (thinkingFamily && candidate.includes('-thinking-')) {
        matchName = `${thinkingFamily}-thinking-*`
      } else if (candidate.startsWith('gpt-4-gizmo')) {
        matchName = 'gpt-4-gizmo-*'
      } else if (candidate.startsWith('gpt-4o-gizmo')) {
        matchName = 'gpt-4o-gizmo-*'
      }
      return allowedModels.has(candidate) || allowedModels.has(matchName)
    })
  }, [modelsQuery.data, pricingQuery.data, preferredKey])
  const ready = Boolean(preferredKey?.id && model)
  const environmentLoading =
    Boolean(preferredKey && selectedGroup) &&
    (modelsQuery.isPending || pricingQuery.isPending)
  const preview = buildCurlCommand({
    endpoint,
    model: model ?? '<model>',
    apiKey: preferredKey
      ? formatDisplayKey(`sk-${preferredKey.key}`)
      : 'sk-...',
  })

  const copyRequest = async () => {
    if (!preferredKey || !model || isCopying) return
    setIsCopying(true)
    try {
      const key = await getFullApiKey(preferredKey.id)
      const copied = await copyToClipboard(
        buildCurlCommand({ endpoint, apiKey: key, model })
      )
      if (copied) toast.success(t('Copied to clipboard'))
      else toast.error(t('Failed to copy to clipboard'))
    } catch {
      toast.error(t('Failed to copy to clipboard'))
    } finally {
      setIsCopying(false)
    }
  }

  return (
    <Collapsible
      open={expanded}
      onOpenChange={(open) => {
        setManualExpanded(open)
        saveSetupGuideExpanded(open)
      }}
      className='min-w-0 border-t pt-3'
    >
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
          <h2 className='text-sm font-medium'>
            {complete ? t('Setup guide complete') : t('Setup guide')}
          </h2>
          <span className='text-muted-foreground text-xs'>
            {t('Setup progress: {{completed}}/{{total}}', {
              completed: completedCount,
              total: steps.length,
            })}
          </span>
          <CollapsibleTrigger
            render={
              <Button variant='ghost' size='sm' className='group h-8 gap-1.5' />
            }
          >
            <ChevronDown
              aria-hidden='true'
              className='size-3.5 transition-transform group-aria-expanded:rotate-180 motion-reduce:transition-none'
            />
            {expanded ? t('Hide setup guide') : t('Show setup guide')}
          </CollapsibleTrigger>
        </div>
        <div className='flex max-w-full min-w-0 items-center gap-2 text-xs'>
          <span className='text-muted-foreground shrink-0'>
            {t('Base URL')}
          </span>
          <code className='min-w-0 truncate' title={baseUrl}>
            {baseUrl}
          </code>
          <CopyButton
            value={baseUrl}
            aria-label={t('Copy Base URL')}
            className='size-8'
          />
        </div>
      </div>
      {keysQuery.isError && (
        <p role='alert' className='text-destructive mt-2 text-xs'>
          {t('Failed to load API keys')}
        </p>
      )}
      <CollapsibleContent className='pt-4'>
        <div className='grid min-w-0 gap-5 lg:grid-cols-2'>
          <ol className='space-y-1'>
            {steps.map((step) => (
              <li key={step.to}>
                <Link
                  to={step.to}
                  className='hover:bg-muted focus-visible:ring-ring flex items-start gap-3 rounded-md px-2 py-2.5 outline-none focus-visible:ring-2'
                >
                  {step.completed ? (
                    <Check
                      aria-hidden='true'
                      className='text-success mt-0.5 size-4 shrink-0'
                    />
                  ) : (
                    <Circle
                      aria-hidden='true'
                      className='text-muted-foreground mt-0.5 size-4 shrink-0'
                    />
                  )}
                  <div>
                    <div className='text-sm font-medium'>{step.title}</div>
                    <div className='text-muted-foreground mt-0.5 text-xs'>
                      {step.description}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
          <div className='min-w-0'>
            <div className='mb-2 flex items-center justify-between gap-3'>
              <h3 className='text-xs font-medium'>{t('First API request')}</h3>
              <Button
                size='sm'
                variant='outline'
                disabled={!ready || isCopying}
                onClick={copyRequest}
                aria-label={t('Copy ready-to-run curl')}
                className='h-8 gap-1.5'
              >
                <Copy aria-hidden='true' className='size-3.5' />
                {isCopying ? t('Loading') : t('Copy')}
              </Button>
            </div>
            <pre className='bg-muted/50 max-w-full overflow-x-auto rounded-md p-3 font-mono text-xs leading-6'>
              <code>{preview}</code>
            </pre>
            {environmentLoading && (
              <p className='text-muted-foreground mt-2 text-xs'>
                {t('Loading...')}
              </p>
            )}
            {!environmentLoading && !ready && (
              <p className='text-muted-foreground mt-2 text-xs'>
                {preferredKey
                  ? t('No models available')
                  : t('Create an API key to unlock the real request')}
              </p>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
