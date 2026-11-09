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
export type IQStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'error'
  | 'timeout'
  | 'unavailable'
  | 'invalid_artifact'
  | 'interrupted'

export interface IQTarget {
  group: string
  models: string[]
}

export interface IQConfig {
  version: number
  prompt: string
  targets: IQTarget[]
  enabled: boolean
  schedule_mode: 'interval' | 'daily'
  interval_hours: number
  daily_time: string
  timezone: 'Asia/Shanghai'
  next_run_at: number
  updated_at: number
  updated_by: number
}

export type IQConfigInput = Omit<
  IQConfig,
  'next_run_at' | 'updated_at' | 'updated_by'
>

export interface IQResult {
  id: string
  group: string
  model: string
  task_id: string
  config_version: number
  status: IQStatus
  started_at: number
  completed_at: number
  duration_ms: number
  artifact_kind: 'html' | 'svg' | ''
  error_code: string
  error_message: string
}

export interface IQModelCard {
  model: string
  latest: IQResult | null
  progress: {
    status: IQStatus
    started_at: number
    completed_at: number
  } | null
}

export interface IQResults {
  groups: { group: string; models: IQModelCard[] }[]
  active_run: {
    task_id: string
    status: 'pending' | 'running'
    config_version: number
    created_at: number
    total: number
    completed: number
    running: number
    pending: number
  } | null
  next_run_at: number
  schedule_enabled: boolean
  timezone: 'Asia/Shanghai'
}

export interface IQArtifact {
  id: string
  group: string
  model: string
  task_id: string
  config_version: number
  completed_at: number
  artifact_kind: 'html' | 'svg'
  artifact: string
}

// Pair IDs are stable across replacements; metadata is part of artifact identity.
export function artifactRevision(
  result: Pick<IQResult, 'id' | 'task_id' | 'config_version' | 'completed_at'>
): string {
  return JSON.stringify([
    result.id,
    result.task_id,
    result.config_version,
    result.completed_at,
  ])
}
