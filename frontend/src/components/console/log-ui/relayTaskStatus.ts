import type { RelayTaskStatus } from '@/types/console'

export interface RelayTaskStatusMeta {
  labelKey: string
  tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
}

/**
 * Status strings shared by drawing (/api/mj/self) and task (/api/task/self)
 * rows. Unknown values fall back to a neutral chip instead of breaking the
 * page when the backend introduces a new state.
 */
const STATUS_META: Record<string, RelayTaskStatusMeta> = {
  SUCCESS: { labelKey: 'relayLogs.statusSuccess', tone: 'success' },
  NOT_START: { labelKey: 'relayLogs.statusNotStart', tone: 'neutral' },
  SUBMITTED: { labelKey: 'relayLogs.statusQueued', tone: 'warning' },
  QUEUED: { labelKey: 'relayLogs.statusQueued', tone: 'warning' },
  IN_PROGRESS: { labelKey: 'relayLogs.statusInProgress', tone: 'info' },
  MODAL: { labelKey: 'relayLogs.statusWaiting', tone: 'warning' },
  FAILURE: { labelKey: 'relayLogs.statusFailed', tone: 'danger' },
}

const UNKNOWN_META: RelayTaskStatusMeta = {
  labelKey: 'relayLogs.statusUnknown',
  tone: 'neutral',
}

export function relayTaskStatusMeta(
  status: RelayTaskStatus
): RelayTaskStatusMeta {
  return STATUS_META[status] ?? UNKNOWN_META
}

/**
 * Elapsed seconds between submit and finish, or null while the task has not
 * finished. Drawing rows carry millisecond timestamps, task rows seconds.
 */
export function relayTaskDurationSeconds(
  submitTime: number,
  finishTime: number,
  unit: 'milliseconds' | 'seconds'
): number | null {
  if (submitTime <= 0 || finishTime <= 0 || finishTime < submitTime) {
    return null
  }
  const elapsed = finishTime - submitTime
  return unit === 'milliseconds' ? elapsed / 1000 : elapsed
}
