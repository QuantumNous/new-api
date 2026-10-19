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
import { Puzzle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SidebarData } from '@/components/layout/types'
import { useSidebarData } from '@/hooks/use-sidebar-data'
import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import type {
  AppAuthorizeRequest,
  AppAuthorizeResult,
  AppLaunchContext,
  AppNavigationItem,
  AppSurface,
} from './types'

type ServerEnvelope<T> = {
  success: boolean
  message?: string
  data: T
}

export async function listAppPlugins(
  signal?: AbortSignal
): Promise<AppNavigationItem[]> {
  const response = await api.get<ServerEnvelope<AppNavigationItem[]>>(
    '/api/app_plugins',
    { signal, skipErrorHandler: true }
  )
  return requireServerSuccess(response.data).data
}

export async function getAppLaunchContext(
  appKey: string,
  surface: AppSurface,
  signal?: AbortSignal
): Promise<AppLaunchContext> {
  const response = await api.get<ServerEnvelope<AppLaunchContext>>(
    `/api/app_plugins/${encodeURIComponent(appKey)}/launch-context`,
    { params: { surface }, signal, skipErrorHandler: true }
  )
  return requireServerSuccess(response.data).data
}

export async function authorizeApp(
  appKey: string,
  request: AppAuthorizeRequest,
  idempotencyKey: string,
  signal?: AbortSignal
): Promise<AppAuthorizeResult> {
  const response = await api.post<ServerEnvelope<AppAuthorizeResult>>(
    `/api/app_plugins/${encodeURIComponent(appKey)}/authorize`,
    request,
    {
      headers: { 'Idempotency-Key': idempotencyKey },
      signal,
      singleUseAuthorization: true,
      skipErrorHandler: true,
    }
  )
  return requireServerSuccess(response.data).data
}

export function resolveAppNavigation(
  apps: AppNavigationItem[],
  dashboardPath: string,
  surface: AppSurface
): AppNavigationItem | null {
  if (!dashboardPath.startsWith('/') || dashboardPath.startsWith('//')) {
    return null
  }

  return (
    apps.find((app) => {
      const canonicalPath = `/apps/${app.key}`
      return (
        app.dashboard_path === canonicalPath &&
        dashboardPath === canonicalPath &&
        app.enabled_surfaces.includes(surface)
      )
    }) ?? null
  )
}

export function useAppSidebarData(): SidebarData & { error: Error | null } {
  const staticSidebar = useSidebarData()
  const sessionID = useAuthStore((state) => state.auth.session?.sid)
  const { i18n, t } = useTranslation()
  const language = i18n.resolvedLanguage || i18n.language
  const appsQuery = useQuery({
    queryKey: ['app-plugins', 'navigation', sessionID],
    queryFn: ({ signal }) => listAppPlugins(signal),
    enabled: Boolean(sessionID),
  })
  const apps = appsQuery.error ? [] : (appsQuery.data ?? [])
  const appItems = apps.flatMap((app) => {
    if (resolveAppNavigation([app], app.dashboard_path, 'embedded') === null) {
      return []
    }

    const activeLabel = app.name[language]
    const englishLabel = app.name.en
    const firstLabel = Object.values(app.name).find(
      (label) => label.trim() !== ''
    )
    return [
      {
        title: activeLabel || englishLabel || firstLabel || app.key,
        url: app.dashboard_path,
        icon: Puzzle,
      },
    ]
  })

  if (appItems.length === 0) {
    return {
      navGroups: staticSidebar.navGroups,
      error: appsQuery.error,
    }
  }

  return {
    navGroups: [
      ...staticSidebar.navGroups,
      { id: 'apps', title: t('Apps'), items: appItems },
    ],
    error: appsQuery.error,
  }
}
