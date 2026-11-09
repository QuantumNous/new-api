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
import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import type {
  IQArtifact,
  IQConfig,
  IQConfigInput,
  IQResults,
  IQTarget,
} from './types'

type Envelope<T> = { success: boolean; message: string; data: T }

async function read<T>(path: string, signal?: AbortSignal): Promise<T> {
  // Opt out of shared session/URL deduplication: permissions and stable-ID
  // artifact revisions can change even within the same session.
  const response = await api.get<Envelope<T>>(`/api/iq-tests/${path}`, {
    signal,
    disableDuplicate: true,
  })
  return requireServerSuccess(response.data).data
}

export const getIQResults = (signal?: AbortSignal) =>
  read<IQResults>('results', signal)
export const getIQConfig = (signal?: AbortSignal) =>
  read<IQConfig>('config', signal)
export const getIQTargets = (signal?: AbortSignal) =>
  read<IQTarget[]>('targets', signal)
export const getIQArtifact = (id: string, signal?: AbortSignal) =>
  read<IQArtifact>(`results/${encodeURIComponent(id)}`, signal)

export async function saveIQConfig(input: IQConfigInput): Promise<IQConfig> {
  const response = await api.put<Envelope<IQConfig>>(
    '/api/iq-tests/config',
    input
  )
  return requireServerSuccess(response.data).data
}

export async function runIQTests(): Promise<{
  task_id: string
  status: 'pending' | 'running'
  created: boolean
}> {
  const response = await api.post<
    Envelope<{
      task_id: string
      status: 'pending' | 'running'
      created: boolean
    }>
  >('/api/iq-tests/run')
  return requireServerSuccess(response.data).data
}
