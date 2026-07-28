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
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CheckCircle2, Loader2, Play } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { formatCurrencyUSD, formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchTokenKey, getApiKeys } from '@/features/keys/api'
import { dataToolQueryKeys, inspectDataTool, runDataTool } from '../api'
import type {
  DataToolInspection,
  DataToolRunResult,
  DataToolSummary,
} from '../types'
import {
  DataToolInputField,
  getInitialDataToolFieldValue,
  parseDataToolFieldValue,
} from './data-tool-input-field'

type DataToolRunnerProps = {
  tool: DataToolSummary
  compact?: boolean
}

function buildInitialValues(inspection: DataToolInspection) {
  const values: Record<string, string> = {}
  for (const [name, field] of Object.entries(inspection.input.properties)) {
    values[name] = getInitialDataToolFieldValue(field)
  }
  return values
}

export function DataToolRunner(props: DataToolRunnerProps) {
  const { t } = useTranslation()
  const setUser = useAuthStore((state) => state.auth.setUser)
  const [values, setValues] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [result, setResult] = useState<DataToolRunResult | null>(null)
  const idempotencyKey = useRef<string | null>(null)
  const inspectionQuery = useQuery({
    queryKey: dataToolQueryKeys.inspect(props.tool.id),
    queryFn: () => inspectDataTool(props.tool.id),
  })
  const apiKeyQuery = useQuery({
    queryKey: ['data-tools', 'runnable-api-key'],
    queryFn: async () => {
      const response = await getApiKeys({ p: 1, size: 100 })
      const now = Math.floor(Date.now() / 1000)
      const token = response.data?.items.find(
        (candidate) =>
          candidate.status === 1 &&
          (candidate.expired_time === -1 || candidate.expired_time > now) &&
          (candidate.unlimited_quota || candidate.remain_quota > 0)
      )
      if (!token) return null
      const keyResponse = await fetchTokenKey(token.id)
      if (!keyResponse.success || !keyResponse.data?.key) {
        throw new Error(keyResponse.message || t('Request failed'))
      }
      return { id: token.id, name: token.name, key: keyResponse.data.key }
    },
    // A missing key is a transient onboarding state. Keep valid keys cached,
    // but make the negative result stale immediately so returning from the
    // API-key creation flow enables the runner without a manual reload.
    staleTime: (query) => (query.state.data ? 5 * 60 * 1000 : 0),
  })

  useEffect(() => {
    if (!inspectionQuery.data) return
    setValues(buildInitialValues(inspectionQuery.data))
    setFormError('')
    setResult(null)
    idempotencyKey.current = null
  }, [inspectionQuery.data])

  const runMutation = useMutation({
    mutationFn: (input: Record<string, unknown>) => {
      if (!apiKeyQuery.data?.key) {
        throw new Error(t('Create an API key to get started'))
      }
      if (!idempotencyKey.current) {
        idempotencyKey.current = nanoid()
      }
      return runDataTool(
        props.tool.id,
        input,
        idempotencyKey.current,
        apiKeyQuery.data.key
      )
    },
    onSuccess: (data) => {
      setResult(data)
      setFormError('')
      idempotencyKey.current = null
      setUser((user) =>
        user ? { ...user, quota: data.remaining_quota } : user
      )
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : t('Request failed'))
    },
  })

  function updateValue(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }))
    setResult(null)
    setFormError('')
    idempotencyKey.current = null
  }

  function submit() {
    const inspection = inspectionQuery.data
    if (!inspection) return
    try {
      const input: Record<string, unknown> = {}
      const required = new Set(inspection.input.required ?? [])
      for (const [name, field] of Object.entries(inspection.input.properties)) {
        const parsed = parseDataToolFieldValue(
          name,
          field,
          values[name] ?? '',
          required.has(name)
        )
        if (parsed !== undefined) input[name] = parsed
      }
      setFormError('')
      runMutation.mutate(input)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('Invalid input'))
    }
  }

  if (inspectionQuery.isPending) {
    return (
      <div className='grid gap-3'>
        <Skeleton className='h-20 rounded-xl' />
        <Skeleton className='h-28 rounded-xl' />
        <Skeleton className='h-9 rounded-lg' />
      </div>
    )
  }

  if (inspectionQuery.isError) {
    return (
      <div className='border-destructive/30 bg-destructive/5 text-destructive rounded-xl border p-3 text-sm'>
        {inspectionQuery.error.message}
      </div>
    )
  }

  const inspection = inspectionQuery.data
  if (!inspection) return null

  return (
    <div className='grid gap-4'>
      <div
        className={cn(
          'bg-muted/35 grid gap-3 rounded-xl border p-3',
          !props.compact && 'sm:grid-cols-3'
        )}
      >
        <div>
          <p className='text-muted-foreground text-xs'>{t('Platform')}</p>
          <p className='mt-0.5 truncate text-sm font-medium'>
            {props.tool.platform}
          </p>
        </div>
        <div>
          <p className='text-muted-foreground text-xs'>{t('Flatkey price')}</p>
          <p className='mt-0.5 text-sm font-medium'>
            {inspection.flatkey_price_usd === 0
              ? t('Free')
              : formatCurrencyUSD(inspection.flatkey_price_usd)}
          </p>
        </div>
        <div>
          <p className='text-muted-foreground text-xs'>{t('Billing owner')}</p>
          <p className='mt-0.5 text-sm font-medium'>{t('Flatkey Credits')}</p>
        </div>
      </div>

      {inspection.quarantined ? (
        <div className='border-destructive/30 bg-destructive/5 text-destructive rounded-xl border p-3 text-sm'>
          {t('Temporarily unavailable')}: {inspection.quarantined}
        </div>
      ) : (
        <div className={cn('grid gap-4', !props.compact && 'sm:grid-cols-2')}>
          {Object.entries(inspection.input.properties).map(([name, field]) => (
            <DataToolInputField
              key={name}
              name={name}
              field={field}
              required={inspection.input.required?.includes(name) ?? false}
              value={values[name] ?? ''}
              onChange={(value) => updateValue(name, value)}
            />
          ))}
          {Object.keys(inspection.input.properties).length === 0 && (
            <p className='text-muted-foreground text-sm'>
              {t('This tool does not require any input.')}
            </p>
          )}
        </div>
      )}

      {formError && (
        <div className='border-destructive/30 bg-destructive/5 text-destructive rounded-xl border p-3 text-sm'>
          {formError}
        </div>
      )}

      {!apiKeyQuery.isPending && !apiKeyQuery.data && (
        <div className='border-primary/20 bg-primary/5 rounded-xl border p-3 text-sm'>
          <Link
            to='/keys'
            className='text-primary font-medium underline underline-offset-4'
          >
            {t('Create an API key to get started')}
          </Link>
        </div>
      )}

      {result && (
        <div className='grid gap-3'>
          <div className='flex flex-wrap items-center gap-2 text-sm'>
            <CheckCircle2 className='size-4 text-emerald-500' />
            <span className='font-medium'>{t('Call completed')}</span>
            <Badge variant='outline'>
              {t('Charged')} {formatCurrencyUSD(result.charged_usd)}
            </Badge>
            <Badge variant='outline'>
              {t('Credits left')} {formatQuota(result.remaining_quota)}
            </Badge>
            <span className='text-muted-foreground'>{result.latencyMs}ms</span>
          </div>
          <pre className='bg-muted max-h-72 overflow-auto rounded-xl border p-3 text-xs'>
            {JSON.stringify(result.output, null, 2)}
          </pre>
        </div>
      )}

      <Button
        className='w-full'
        onClick={submit}
        disabled={
          Boolean(inspection.quarantined) ||
          runMutation.isPending ||
          apiKeyQuery.isPending ||
          !apiKeyQuery.data
        }
      >
        {runMutation.isPending || apiKeyQuery.isPending ? (
          <Loader2 className='animate-spin' />
        ) : (
          <Play />
        )}
        {result ? t('Run again') : t('Run tool')}
      </Button>
    </div>
  )
}
