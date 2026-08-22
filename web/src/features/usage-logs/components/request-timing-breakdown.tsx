import { useTranslation } from 'react-i18next'

import { formatUseTime } from '@/lib/format'
import { cn } from '@/lib/utils'

import type {
  RequestTimingPhase,
  RequestTimingPhaseKey,
} from '../lib/request-timing'

const phaseLabelKeys: Record<RequestTimingPhaseKey, string> = {
  gateway_ms: 'Gateway processing',
  upstream_first_data_ms: 'Upstream first data',
  first_data_to_client_ms: 'First data to client',
  client_stream_ms: 'Client streaming',
  upstream_response_ms: 'Upstream response',
  response_write_ms: 'Response write',
  upstream_error_ms: 'Upstream error',
  finalize_ms: 'Finalization',
}

interface RequestTimingBreakdownProps {
  phases: RequestTimingPhase[]
  className?: string
}

export function RequestTimingBreakdown(props: RequestTimingBreakdownProps) {
  const { t } = useTranslation()
  if (props.phases.length === 0) return null

  return (
    <div
      aria-label={t('Timing breakdown')}
      className={cn('min-w-52 space-y-1 text-xs', props.className)}
    >
      {props.phases.map((phase) => (
        <div
          key={phase.key}
          className='flex items-baseline justify-between gap-4'
        >
          <span className='opacity-75'>{t(phaseLabelKeys[phase.key])}</span>
          <span className='font-medium tabular-nums'>
            {formatUseTime(phase.milliseconds / 1000)}
          </span>
        </div>
      ))}
    </div>
  )
}
