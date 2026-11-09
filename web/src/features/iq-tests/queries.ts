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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { useAuthStore } from '@/stores/auth-store'

import { getIQArtifact, getIQResults } from './api'
import { artifactRevision, type IQResult } from './types'

export function useIQViewerScope(): string | null {
  const user = useAuthStore((state) => state.auth.user)
  const sid = useAuthStore((state) => state.auth.session?.sid)
  const authenticated = useAuthStore((state) => Boolean(state.auth.accessToken))
  if (!user || !sid || !authenticated) return null
  return JSON.stringify([sid, user.id, user.role, user.group, user.permissions])
}

export function isCurrentIQScope(scope: string): boolean {
  const { user, session, accessToken } = useAuthStore.getState().auth
  return Boolean(
    user &&
    session &&
    accessToken &&
    JSON.stringify([
      session.sid,
      user.id,
      user.role,
      user.group,
      user.permissions,
    ]) === scope
  )
}

export const iqKeys = {
  scope: (scope: string) => ['iq-tests', scope] as const,
  results: (scope: string) => [...iqKeys.scope(scope), 'results'] as const,
  config: (scope: string) => [...iqKeys.scope(scope), 'config'] as const,
  targets: (scope: string) => [...iqKeys.scope(scope), 'targets'] as const,
  artifact: (scope: string, result: IQResult) =>
    [...iqKeys.scope(scope), 'artifact', artifactRevision(result)] as const,
}

export const iqQueryOptions = {
  retry: false,
  gcTime: 0,
  staleTime: 0,
  meta: { errorToast: false },
} as const

export function useIQScopeCleanup(scope: string): void {
  const client = useQueryClient()
  useEffect(
    () => () => {
      void client.cancelQueries({ queryKey: iqKeys.scope(scope) })
      client.removeQueries({ queryKey: iqKeys.scope(scope) })
    },
    [client, scope]
  )
}

export function useIQResults(scope: string) {
  return useQuery({
    ...iqQueryOptions,
    queryKey: iqKeys.results(scope),
    queryFn: ({ signal }) => getIQResults(signal),
    // Keep schedules and runs from other administrators visible; pause in background.
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  })
}

export function useIQArtifact(scope: string, result: IQResult) {
  return useQuery({
    ...iqQueryOptions,
    queryKey: iqKeys.artifact(scope, result),
    queryFn: async ({ signal }) => {
      const artifact = await getIQArtifact(result.id, signal)
      if (artifactRevision(artifact) !== artifactRevision(result)) {
        throw new Error('IQ result changed; refresh the gallery')
      }
      return artifact
    },
  })
}
