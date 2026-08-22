import type { RequestTimingData } from '../types'

const phaseKeys = [
  'gateway_ms',
  'upstream_first_data_ms',
  'upstream_response_ms',
  'upstream_error_ms',
  'first_data_to_client_ms',
  'response_write_ms',
  'client_stream_ms',
  'finalize_ms',
] as const

export type RequestTimingPhaseKey = (typeof phaseKeys)[number]

export interface RequestTimingPhase {
  key: RequestTimingPhaseKey
  milliseconds: number
}

export interface TimingPresentation {
  totalSeconds: number
  firstTokenSeconds: number | null
  phases: RequestTimingPhase[]
}

function isDuration(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

export function buildTimingPresentation(
  useTimeSec: number,
  frtMs: number | undefined,
  requestTiming: RequestTimingData | undefined
): TimingPresentation {
  const totalSeconds = isDuration(requestTiming?.total_ms)
    ? requestTiming.total_ms / 1000
    : useTimeSec

  let firstTokenSeconds: number | null = null
  if (
    isDuration(requestTiming?.gateway_ms) &&
    isDuration(requestTiming?.upstream_first_data_ms)
  ) {
    firstTokenSeconds =
      (requestTiming.gateway_ms + requestTiming.upstream_first_data_ms) / 1000
  } else if (isDuration(frtMs) && frtMs > 0) {
    firstTokenSeconds = frtMs / 1000
  }

  const phases: RequestTimingPhase[] = []
  for (const key of phaseKeys) {
    const milliseconds = requestTiming?.[key]
    if (isDuration(milliseconds)) {
      phases.push({ key, milliseconds })
    }
  }

  return { totalSeconds, firstTokenSeconds, phases }
}
