import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUpdateOption } from '@/features/system-settings/hooks/use-update-option'
import {
  getRecallEmailQuotaStatus,
  recallCampaignKeys,
  recallEmailHourlyLimitOptionKey,
} from '../api'
import type { ApiResponse, RecallEmailQuotaStatus } from '../types'

const DEFAULT_RECALL_EMAIL_HOURLY_LIMIT = 100
const MIN_RECALL_EMAIL_HOURLY_LIMIT = 1
const MAX_RECALL_EMAIL_HOURLY_LIMIT = 100_000

interface CampaignEmailHourlyLimitControlViewProps {
  error: string
  inputValue: string
  pending: boolean
  quota: RecallEmailQuotaStatus
  onInputChange: (value: string) => void
  onSave: () => void
}

// eslint-disable-next-line react-refresh/only-export-components
export function parseRecallEmailHourlyLimit(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null
  const limit = Number(value)
  if (
    !Number.isSafeInteger(limit) ||
    limit < MIN_RECALL_EMAIL_HOURLY_LIMIT ||
    limit > MAX_RECALL_EMAIL_HOURLY_LIMIT
  ) {
    return null
  }
  return limit
}

// eslint-disable-next-line react-refresh/only-export-components
export function applyRecallEmailHourlyLimit(
  quota: RecallEmailQuotaStatus,
  limit: number
): RecallEmailQuotaStatus {
  return {
    ...quota,
    limit,
    remaining: Math.max(0, limit - quota.used),
    exhausted: quota.used >= limit,
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function getRecallEmailQuotaPollInterval(
  quota: RecallEmailQuotaStatus | undefined,
  nowMilliseconds: number,
  visible: boolean
): number | false {
  if (!visible) return false
  if (!quota?.resets_at) return 60_000
  return Math.max(1_000, quota.resets_at * 1_000 - nowMilliseconds)
}

// eslint-disable-next-line react-refresh/only-export-components
export function syncRecallEmailHourlyLimitFromServer(
  inputValue: string,
  confirmedLimit: number,
  serverLimit: number
): { inputValue: string; confirmedLimit: number } {
  return {
    inputValue:
      inputValue === String(confirmedLimit)
        ? String(serverLimit)
        : inputValue,
    confirmedLimit: serverLimit,
  }
}

function createDefaultQuota(): RecallEmailQuotaStatus {
  return {
    limit: DEFAULT_RECALL_EMAIL_HOURLY_LIMIT,
    used: 0,
    remaining: DEFAULT_RECALL_EMAIL_HOURLY_LIMIT,
    window_started_at: 0,
    resets_at: 0,
    exhausted: false,
  }
}

export function CampaignEmailHourlyLimitControlView(
  props: CampaignEmailHourlyLimitControlViewProps
): React.JSX.Element {
  const { t } = useTranslation()
  const resetTime = props.quota.resets_at
    ? new Date(props.quota.resets_at * 1_000).toLocaleString()
    : '-'

  return (
    <div className='min-w-80 space-y-2 rounded-lg border p-3'>
      <form
        className='flex items-end gap-2'
        onSubmit={(event) => {
          event.preventDefault()
          props.onSave()
        }}
      >
        <div className='min-w-0 flex-1 space-y-1'>
          <Label htmlFor='recall-email-hourly-limit'>
            {t('Activity email hourly limit')}
          </Label>
          <Input
            id='recall-email-hourly-limit'
            type='number'
            min={MIN_RECALL_EMAIL_HOURLY_LIMIT}
            max={MAX_RECALL_EMAIL_HOURLY_LIMIT}
            step={1}
            disabled={props.pending}
            value={props.inputValue}
            onChange={(event) => props.onInputChange(event.target.value)}
          />
        </div>
        <Button type='submit' disabled={props.pending}>
          {props.pending ? t('Saving') : t('Save hourly limit')}
        </Button>
      </form>
      <p className='text-sm font-medium'>
        {t('{{used}} / {{limit}} sent this hour', {
          used: props.quota.used,
          limit: props.quota.limit,
        })}
      </p>
      <p className='text-muted-foreground text-xs'>
        {t(
          'All Activity Configuration campaigns share this hourly limit. Other system emails are unaffected.'
        )}
      </p>
      <p className='text-muted-foreground text-xs'>
        {t('Attempts count when SMTP sending starts and are not refunded.')}
      </p>
      <p className='text-muted-foreground text-xs'>
        {props.quota.exhausted
          ? t(
              'Hourly limit reached. Queued activity emails will resume at {{time}}.',
              { time: resetTime }
            )
          : t('Quota resets at {{time}}.', { time: resetTime })}
      </p>
      {props.error ? (
        <p role='alert' className='text-destructive text-xs'>
          {t(props.error)}
        </p>
      ) : null}
    </div>
  )
}

export function CampaignEmailHourlyLimitControl(): React.JSX.Element {
  const queryClient = useQueryClient()
  const updateOption = useUpdateOption()
  const [inputValue, setInputValue] = useState(
    String(DEFAULT_RECALL_EMAIL_HOURLY_LIMIT)
  )
  const confirmedLimitRef = useRef(
    DEFAULT_RECALL_EMAIL_HOURLY_LIMIT
  )
  const [error, setError] = useState('')
  const quotaQuery = useQuery({
    queryKey: recallCampaignKeys.emailQuota,
    queryFn: getRecallEmailQuotaStatus,
    refetchInterval: (query) =>
      getRecallEmailQuotaPollInterval(
        (query.state.data as ApiResponse<RecallEmailQuotaStatus> | undefined)
          ?.data,
        Date.now(),
        typeof document === 'undefined' || !document.hidden
      ),
    refetchIntervalInBackground: false,
  })
  const quota = quotaQuery.data?.data ?? createDefaultQuota()

  useEffect(() => {
    if (!quotaQuery.data?.data) return
    const serverLimit = quotaQuery.data.data.limit
    const previousConfirmedLimit = confirmedLimitRef.current
    confirmedLimitRef.current = serverLimit
    // Polling may update the confirmed value, but it must preserve an unsaved edit.
    setInputValue(
      (currentInput) =>
        syncRecallEmailHourlyLimitFromServer(
          currentInput,
          previousConfirmedLimit,
          serverLimit
        ).inputValue
    )
  }, [quotaQuery.data])

  const save = async () => {
    const limit = parseRecallEmailHourlyLimit(inputValue)
    if (limit === null) {
      setError('Hourly limit must be between 1 and 100000.')
      return
    }
    setError('')
    try {
      const response = await updateOption.mutateAsync({
        key: recallEmailHourlyLimitOptionKey,
        value: String(limit),
      })
      if (!response.success) {
        setInputValue(String(confirmedLimitRef.current))
        setError(response.message || 'Failed to update setting')
        return
      }
      const nextQuota = applyRecallEmailHourlyLimit(quota, limit)
      queryClient.setQueryData(recallCampaignKeys.emailQuota, {
        success: true,
        data: nextQuota,
      })
      confirmedLimitRef.current = limit
      setInputValue(String(limit))
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: recallCampaignKeys.emailQuota,
        }),
        queryClient.invalidateQueries({ queryKey: ['system-options'] }),
      ])
    } catch (updateError) {
      setInputValue(String(confirmedLimitRef.current))
      setError(
        updateError instanceof Error && updateError.message.trim()
          ? updateError.message
          : 'Failed to update setting'
      )
    }
  }

  return (
    <CampaignEmailHourlyLimitControlView
      error={error}
      inputValue={inputValue}
      pending={updateOption.isPending}
      quota={quota}
      onInputChange={(value) => {
        setInputValue(value)
        setError('')
      }}
      onSave={() => void save()}
    />
  )
}
