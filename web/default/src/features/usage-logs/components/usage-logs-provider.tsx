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
import { useNavigate } from '@tanstack/react-router'
/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'

import type { UsageLogsSectionId } from '../section-registry'
import type { ChannelAffinityInfo } from '../types'

/**
 * Usage-logs page mode.
 *
 * - `self`: personal logs only (`/api/log/self`, console entry)
 * - `site`: platform-wide admin logs (`/api/log`, admin entry)
 *
 * Mode is fixed by route so console and admin no longer share one blended page.
 */
export type UsageLogsMode = 'self' | 'site'

/** Search params shared by personal and site usage-logs routes. */
export type UsageLogsSearch = {
  page?: number
  pageSize?: number
  type?: string[]
  filter?: string
  model?: string
  token?: string
  channel?: string
  group?: string
  username?: string
  requestId?: string
  upstreamRequestId?: string
  startTime?: number
  endTime?: number
}

interface UsageLogsContextValue {
  mode: UsageLogsMode
  /** Path prefix without trailing section, e.g. `/usage-logs` or `/admin/usage-logs`. */
  basePath: string
  section: UsageLogsSectionId
  searchParams: UsageLogsSearch
  /** Navigate within the current mode's usage-logs section, merging search. */
  navigateLogs: (options: {
    section?: UsageLogsSectionId
    search?: UsageLogsSearch
  }) => void
  selectedUserId: number | null
  setSelectedUserId: (userId: number | null) => void
  userInfoDialogOpen: boolean
  setUserInfoDialogOpen: (open: boolean) => void
  affinityTarget: ChannelAffinityInfo | null
  setAffinityTarget: (target: ChannelAffinityInfo | null) => void
  affinityDialogOpen: boolean
  setAffinityDialogOpen: (open: boolean) => void
  sensitiveVisible: boolean
  setSensitiveVisible: (visible: boolean) => void
}

const UsageLogsContext = createContext<UsageLogsContextValue | undefined>(
  undefined
)

export function UsageLogsProvider(props: {
  mode: UsageLogsMode
  basePath: string
  section: UsageLogsSectionId
  searchParams: UsageLogsSearch
  children: ReactNode
}) {
  const navigate = useNavigate()
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [userInfoDialogOpen, setUserInfoDialogOpen] = useState(false)
  const [affinityTarget, setAffinityTarget] =
    useState<ChannelAffinityInfo | null>(null)
  const [affinityDialogOpen, setAffinityDialogOpen] = useState(false)
  const [sensitiveVisible, setSensitiveVisible] = useState(true)

  const navigateLogs = useCallback(
    (options: { section?: UsageLogsSectionId; search?: UsageLogsSearch }) => {
      const nextSection = options.section ?? props.section
      const to =
        props.mode === 'site'
          ? '/admin/usage-logs/$section'
          : '/usage-logs/$section'
      void navigate({
        to,
        params: { section: nextSection },
        search: options.search ?? props.searchParams,
      })
    },
    [navigate, props.mode, props.searchParams, props.section]
  )

  return (
    <UsageLogsContext.Provider
      value={{
        mode: props.mode,
        basePath: props.basePath,
        section: props.section,
        searchParams: props.searchParams,
        navigateLogs,
        selectedUserId,
        setSelectedUserId,
        userInfoDialogOpen,
        setUserInfoDialogOpen,
        affinityTarget,
        setAffinityTarget,
        affinityDialogOpen,
        setAffinityDialogOpen,
        sensitiveVisible,
        setSensitiveVisible,
      }}
    >
      {props.children}
    </UsageLogsContext.Provider>
  )
}

export function useUsageLogsContext() {
  const context = useContext(UsageLogsContext)
  if (!context) {
    throw new Error('useUsageLogsContext must be used within UsageLogsProvider')
  }
  return context
}

/**
 * Resolves whether the current usage-logs page is the site-wide admin view.
 * Data fetching and admin-only UI must key off `isAdminView`, which is fixed
 * by route mode — not by an in-page All/Mine toggle.
 */
export function useLogsViewScope() {
  const { mode } = useUsageLogsContext()

  return {
    mode,
    /** Site-wide page is only mounted for admins; still true when mode is site. */
    isAdminView: mode === 'site',
  }
}
