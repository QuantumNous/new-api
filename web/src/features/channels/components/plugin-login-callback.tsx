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
import { AlertCircle } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Main } from '@/components/layout'
import { LoadingState } from '@/components/loading-state'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PluginIcon } from '@/features/task-plugins/components/plugin-icon'
import type { PluginIconInput } from '@/features/task-plugins/lib/plugin-icon'
import {
  ADMIN_PERMISSION_ACTIONS,
  ADMIN_PERMISSION_RESOURCES,
  hasPermission,
} from '@/lib/admin-permissions'
import {
  getServerErrorMessage,
  requireServerSuccess,
} from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import { getTaskPluginOptions, submitPluginLoginCallback } from '../api'
import {
  PLUGIN_LOGIN_BROADCAST_CHANNEL,
  type PluginLoginStep,
} from '../lib/plugin-login'
import { PluginCredentialDetails } from './dialogs/plugin-login-steps'

type CallbackResult =
  | { status: 'pending' }
  | { status: 'received'; step: PluginLoginStep }
  | { status: 'failed'; error: unknown }

function readCallbackParams(): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(window.location.search))
}

/** Tells the login dialog in the other tab how the callback went. */
function tellLoginDialog(message: unknown) {
  if (typeof BroadcastChannel === 'undefined') return
  const channel = new BroadcastChannel(PLUGIN_LOGIN_BROADCAST_CHANNEL)
  channel.postMessage(message)
  channel.close()
}

/**
 * The page the vendor redirects to after sign-in. It hands the query to the
 * server, then passes the next step to the login dialog in the other tab.
 */
export function PluginLoginCallback(props: { pluginKey: string }) {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)
  const canBind = hasPermission(
    user,
    ADMIN_PERMISSION_RESOURCES.TASK_PLUGIN,
    ADMIN_PERMISSION_ACTIONS.BIND
  )
  const optionsQuery = useQuery({
    queryKey: ['task-plugin-options'],
    queryFn: async () => requireServerSuccess(await getTaskPluginOptions()),
    enabled: canBind,
    staleTime: 60 * 1000,
    meta: { errorToast: false },
  })
  const plugin: PluginIconInput = optionsQuery.data?.find(
    (item) => item.key === props.pluginKey
  ) ?? { key: props.pluginKey }
  const name = plugin.name || plugin.key

  const [params] = useState(readCallbackParams)
  const [result, setResult] = useState<CallbackResult>({ status: 'pending' })
  // Refs survive StrictMode's simulated remount, so the code is sent once.
  const sent = useRef(false)
  useEffect(() => {
    if (sent.current) return
    sent.current = true
    // The query holds the authorization code: keep it out of the address bar
    // and the session history.
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname
    )
    submitPluginLoginCallback(props.pluginKey, params)
      .then((data) => {
        setResult({ status: 'received', step: data.step })
        tellLoginDialog({ channel_id: data.channel_id, step: data.step })
      })
      .catch((error: unknown) => {
        setResult({ status: 'failed', error })
        // A failure has no channel yet: the dialog matches the flow by state.
        if (params.state) {
          tellLoginDialog({
            state: params.state,
            error: getServerErrorMessage(error, ''),
          })
        }
      })
  }, [params, props.pluginKey])

  let content: ReactNode
  if (result.status === 'pending') {
    content = (
      <LoadingState inline size='sm' message={t('Finishing sign-in...')} />
    )
  } else if (result.status === 'failed') {
    content = (
      <>
        <Alert variant='destructive'>
          <AlertCircle />
          <AlertTitle>{t('Login failed')}</AlertTitle>
          <AlertDescription>
            {getServerErrorMessage(result.error, t('Login failed'))}
          </AlertDescription>
        </Alert>
        <p className='text-muted-foreground text-sm'>
          {t('Close this tab and try again from the login dialog.')}
        </p>
      </>
    )
  } else if (result.step.type === 'done') {
    content = (
      <>
        <PluginCredentialDetails credential={result.step.credential} />
        <p className='text-muted-foreground text-sm'>
          {t('You can close this tab.')}
        </p>
      </>
    )
  } else {
    content = (
      <p className='text-sm'>
        {t('Continue in the login dialog. You can close this tab.')}
      </p>
    )
  }

  return (
    <Main>
      <div className='flex min-h-0 flex-1 items-start justify-center overflow-auto px-3 py-6 sm:px-4 sm:py-12'>
        <Card className='w-full max-w-md'>
          <CardHeader>
            <CardTitle className='flex min-w-0 items-center gap-2'>
              <PluginIcon plugin={plugin} size={24} />
              <span className='min-w-0 truncate'>
                {t('Log in to {{name}}', { name })}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className='flex flex-col gap-4'>{content}</CardContent>
        </Card>
      </div>
    </Main>
  )
}
