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
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/stores/auth-store'

import {
  authorizeApp,
  getAppLaunchContext,
  listAppPlugins,
  resolveAppNavigation,
} from './api'
import type { AppLaunchContext, EmbeddedReadyMessage } from './types'

type EmbeddedAuthState = {
  iframeRef: RefObject<HTMLIFrameElement | null>
  src: string | undefined
  error: Error | null
  isPending: boolean
  title: string
}

type AuthorizationState = {
  identity: string
  src?: string
  error?: Error
}

type LaunchContextState = {
  identity: string
  context?: AppLaunchContext
  error?: Error
  isPending: boolean
}

type SpentTransaction = {
  identity: string
  controller: AbortController
}

const READY_KEYS = [
  'code_challenge',
  'nonce',
  'state',
  'transaction_id',
  'type',
  'version',
] as const
const APP_UNAVAILABLE_ERROR = new Error('App unavailable')

function isChallenge(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value)) {
    return false
  }

  try {
    const base64 = `${value.replaceAll('-', '+').replaceAll('_', '/')}=`
    const decoded = atob(base64)
    if (decoded.length !== 32) return false
    const canonical = btoa(decoded)
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/, '')
    return canonical === value
  } catch {
    return false
  }
}

function isTransactionID(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 255 &&
    !/[\s\p{C}]/u.test(value)
  )
}

function parseReadyMessage(value: unknown): EmbeddedReadyMessage | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  const keys = Object.keys(value).sort()
  if (
    keys.length !== READY_KEYS.length ||
    !keys.every((key, index) => key === READY_KEYS[index])
  ) {
    return null
  }

  const message = value as Record<string, unknown>
  if (
    message.type !== 'seedance.auth.ready' ||
    message.version !== 1 ||
    !isTransactionID(message.transaction_id) ||
    !isChallenge(message.state) ||
    !isChallenge(message.nonce) ||
    !isChallenge(message.code_challenge)
  ) {
    return null
  }

  return message as EmbeddedReadyMessage
}

export function useEmbeddedAuth(appKey: string): EmbeddedAuthState {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const spentTransactionRef = useRef<SpentTransaction | null>(null)
  const activeIdentityRef = useRef<string | null>(null)
  const activeLaunchIdentityRef = useRef<string | null>(null)
  const [launchContextState, setLaunchContextState] =
    useState<LaunchContextState | null>(null)
  const [authorizationState, setAuthorizationState] =
    useState<AuthorizationState | null>(null)
  const sessionID = useAuthStore((state) => state.auth.session?.sid)
  const { i18n } = useTranslation()
  const appsQuery = useQuery({
    queryKey: ['app-plugins', 'navigation', sessionID],
    queryFn: ({ signal }) => listAppPlugins(signal),
    enabled: Boolean(sessionID),
  })
  const approvedApp = appsQuery.error
    ? null
    : resolveAppNavigation(appsQuery.data ?? [], `/apps/${appKey}`, 'embedded')
  const launchIdentity =
    sessionID && approvedApp
      ? `${sessionID}\u0000${appKey}\u0000${approvedApp.key}`
      : null
  activeLaunchIdentityRef.current = launchIdentity

  useEffect(() => {
    setLaunchContextState(null)
    if (!launchIdentity) return

    const controller = new AbortController()
    setLaunchContextState({
      identity: launchIdentity,
      isPending: true,
    })
    const loadContext = async () => {
      let loadedContext: AppLaunchContext
      try {
        loadedContext = await getAppLaunchContext(
          appKey,
          'embedded',
          controller.signal
        )
        if (
          loadedContext.app_key !== appKey ||
          loadedContext.surface !== 'embedded' ||
          new URL(loadedContext.start_url).origin !== loadedContext.origin
        ) {
          throw APP_UNAVAILABLE_ERROR
        }
      } catch {
        if (
          controller.signal.aborted ||
          activeLaunchIdentityRef.current !== launchIdentity
        ) {
          return
        }
        setLaunchContextState({
          identity: launchIdentity,
          error: APP_UNAVAILABLE_ERROR,
          isPending: false,
        })
        return
      }
      if (
        controller.signal.aborted ||
        activeLaunchIdentityRef.current !== launchIdentity
      ) {
        return
      }
      setLaunchContextState({
        identity: launchIdentity,
        context: loadedContext,
        isPending: false,
      })
    }
    void loadContext()

    return () => controller.abort()
  }, [appKey, launchIdentity])

  const currentLaunchContext =
    launchContextState?.identity === launchIdentity ? launchContextState : null
  const context = currentLaunchContext?.context
  const identity =
    launchIdentity && context
      ? `${launchIdentity}\u0000${context.origin}\u0000${context.start_url}`
      : null
  activeIdentityRef.current = identity

  useLayoutEffect(() => {
    setAuthorizationState(null)
    if (!identity || !context) return

    if (spentTransactionRef.current?.identity !== identity) {
      spentTransactionRef.current?.controller.abort()
      spentTransactionRef.current = null
    }

    const handleMessage = (event: MessageEvent) => {
      if (activeIdentityRef.current !== identity) return

      if (
        event.origin !== context.origin ||
        event.source !== iframeRef.current?.contentWindow
      ) {
        return
      }

      const message = parseReadyMessage(event.data)
      if (message === null || spentTransactionRef.current !== null) {
        return
      }

      const controller = new AbortController()
      spentTransactionRef.current = { identity, controller }
      const authorize = async () => {
        try {
          const result = await authorizeApp(
            appKey,
            {
              surface: 'embedded',
              transaction_id: message.transaction_id,
              state: message.state,
              nonce: message.nonce,
              code_challenge: message.code_challenge,
              code_challenge_method: 'S256',
            },
            crypto.randomUUID(),
            controller.signal
          )
          if (
            controller.signal.aborted ||
            activeIdentityRef.current !== identity ||
            useAuthStore.getState().auth.session?.sid !== sessionID
          ) {
            return
          }

          let launchOrigin: string
          try {
            launchOrigin = new URL(result.launch_url).origin
          } catch {
            throw APP_UNAVAILABLE_ERROR
          }
          if (
            result.surface !== 'embedded' ||
            launchOrigin !== context.origin
          ) {
            throw APP_UNAVAILABLE_ERROR
          }
          setAuthorizationState({ identity, src: result.launch_url })
        } catch (error) {
          if (
            controller.signal.aborted ||
            activeIdentityRef.current !== identity
          ) {
            return
          }
          setAuthorizationState({
            identity,
            error: error instanceof Error ? error : APP_UNAVAILABLE_ERROR,
          })
        }
      }
      void authorize()
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
      if (spentTransactionRef.current?.identity === identity) {
        spentTransactionRef.current.controller.abort()
        spentTransactionRef.current = null
      }
    }
  }, [appKey, context, identity, sessionID])

  const language = i18n.resolvedLanguage || i18n.language
  const title =
    approvedApp?.name[language] ||
    approvedApp?.name.en ||
    Object.values(approvedApp?.name ?? {}).find(
      (label) => label.trim() !== ''
    ) ||
    approvedApp?.key ||
    appKey
  const isPending =
    Boolean(sessionID) &&
    (appsQuery.isPending ||
      (launchIdentity !== null &&
        (currentLaunchContext === null || currentLaunchContext.isPending)))
  const currentAuthorization =
    authorizationState?.identity === identity ? authorizationState : null
  let error =
    currentAuthorization?.error ??
    appsQuery.error ??
    currentLaunchContext?.error ??
    null
  if (
    !isPending &&
    error === null &&
    (!sessionID || approvedApp === null || context === undefined)
  ) {
    error = APP_UNAVAILABLE_ERROR
  }

  return {
    iframeRef,
    src: currentAuthorization?.src ?? context?.start_url,
    error,
    isPending,
    title,
  }
}
