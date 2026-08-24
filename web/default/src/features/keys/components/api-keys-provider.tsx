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
import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { trackYahooApiKeyCreatedConversion } from '@/lib/analytics/yahoo'
import useDialogState from '@/hooks/use-dialog'
import { useModelAccess } from '@/features/available-models'
import { ensureInitialApiKey, fetchTokenKey, fetchTokenKeysBatch } from '../api'
import { ERROR_MESSAGES } from '../constants'
import {
  buildDefaultApiKeyPayload,
  ensureInitialApiKeyCreateOnce,
  resetInitialApiKeyCreateOnce,
} from '../lib'
import {
  getCreateDialogDeepLinkAction,
  getCreateDialogRequestTransition,
} from '../lib/api-key-create-dialog'
import { type ApiKey, type ApiKeysDialogType } from '../types'
import { ApiKeyRevealDialog } from './api-key-reveal-dialog'

type ApiKeysContextType = {
  open: ApiKeysDialogType | null
  setOpen: (str: ApiKeysDialogType | null) => void
  currentRow: ApiKey | null
  setCurrentRow: React.Dispatch<React.SetStateAction<ApiKey | null>>
  refreshTrigger: number
  triggerRefresh: () => void
  resolvedKey: string
  setResolvedKey: React.Dispatch<React.SetStateAction<string>>
  resolveRealKey: (id: number) => Promise<string | null>
  resolveRealKeysBatch: (ids: number[]) => Promise<Record<number, string>>
  resolvedKeys: Record<number, string>
  loadingKeys: Record<number, boolean>
  copiedKeyId: number | null
  markKeyCopied: (id: number) => void
  initialCreateGroup?: string | null
  createRequestKey: string | null
  createRequestedGroup?: string
  modelAccessQuery: ReturnType<typeof useModelAccess>
}

type ApiKeysProviderProps = {
  children: React.ReactNode
  autoCreateRequested?: boolean
  onAutoCreateConsumed?: () => void
  createDialogRequested?: boolean
  requestedCreateGroup?: string
  onCreateDialogConsumed?: () => void
}

const ApiKeysContext = React.createContext<ApiKeysContextType | null>(null)

export function ApiKeysProvider(props: ApiKeysProviderProps) {
  const { t } = useTranslation()
  const autoCreateRequested = props.autoCreateRequested
  const onAutoCreateConsumed = props.onAutoCreateConsumed
  const createDialogRequested = props.createDialogRequested === true
  const createRequestKey = getCreateDialogRequestTransition(
    null,
    createDialogRequested,
    props.requestedCreateGroup
  ).requestKey
  const authUserId = useAuthStore((state) => state.auth.user?.id)
  const [open, setDialogOpen] = useDialogState<ApiKeysDialogType>(null)
  const [initialCreateGroup, setInitialCreateGroup] = useState<
    string | null | undefined
  >(undefined)
  const [currentRow, setCurrentRow] = useState<ApiKey | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [resolvedKey, setResolvedKey] = useState('')
  const [autoRevealKey, setAutoRevealKey] = useState<string | null>(null)

  const [resolvedKeys, setResolvedKeys] = useState<Record<number, string>>({})
  const [loadingKeys, setLoadingKeys] = useState<Record<number, boolean>>({})
  const pendingRequests = useRef<Record<number, Promise<string | null>>>({})
  const [autoCreateRetryNonce, setAutoCreateRetryNonce] = useState(0)
  const modelAccessQuery = useModelAccess()
  const deepLinkActiveRef = useRef(false)
  const didOpenCreateDeepLinkRef = useRef(false)
  const didResolveCreateDeepLinkRef = useRef(false)
  const createDeepLinkRequestKeyRef = useRef<string | null>(null)
  const onCreateDialogConsumedRef = useRef(props.onCreateDialogConsumed)

  const [copiedKeyId, setCopiedKeyId] = useState<number | null>(null)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    return () => clearTimeout(copiedTimerRef.current)
  }, [])

  const markKeyCopied = useCallback((id: number) => {
    setCopiedKeyId(id)
    clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = setTimeout(() => setCopiedKeyId(null), 2000)
  }, [])

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1)
  }, [])

  const onAutoCreateConsumedRef = useRef(onAutoCreateConsumed)
  const retryAutoCreateRef = useRef<() => void>(() => {})
  const tRef = useRef(t)

  useEffect(() => {
    onAutoCreateConsumedRef.current = onAutoCreateConsumed
    onCreateDialogConsumedRef.current = props.onCreateDialogConsumed
    tRef.current = t
  }, [onAutoCreateConsumed, props.onCreateDialogConsumed, t])

  const setOpen = useCallback(
    (nextOpen: ApiKeysDialogType | null) => {
      setDialogOpen(nextOpen)
      if (nextOpen === null) {
        setInitialCreateGroup(undefined)
        if (deepLinkActiveRef.current) {
          deepLinkActiveRef.current = false
          onCreateDialogConsumedRef.current?.()
        }
      }
    },
    [setDialogOpen]
  )

  useEffect(() => {
    const requestTransition = getCreateDialogRequestTransition(
      createDeepLinkRequestKeyRef.current,
      createDialogRequested,
      props.requestedCreateGroup
    )
    if (requestTransition.shouldReset) {
      didOpenCreateDeepLinkRef.current = false
      didResolveCreateDeepLinkRef.current = false
      createDeepLinkRequestKeyRef.current = requestTransition.requestKey
      setInitialCreateGroup(undefined)
    }
    if (!createDialogRequested) {
      return
    }
    const action = getCreateDialogDeepLinkAction(
      createDialogRequested,
      modelAccessQuery.data,
      modelAccessQuery.isError,
      props.requestedCreateGroup
    )

    if (
      !didResolveCreateDeepLinkRef.current &&
      action.resolvedGroup !== undefined
    ) {
      didResolveCreateDeepLinkRef.current = true
      setInitialCreateGroup(action.resolvedGroup)
    }

    if (didOpenCreateDeepLinkRef.current || !action.shouldOpen) return

    didOpenCreateDeepLinkRef.current = true
    deepLinkActiveRef.current = true
    setDialogOpen('create')
  }, [
    createDialogRequested,
    modelAccessQuery.data,
    modelAccessQuery.isError,
    props.requestedCreateGroup,
    setDialogOpen,
  ])

  const retryAutoCreate = useCallback(() => {
    resetInitialApiKeyCreateOnce()
    setAutoCreateRetryNonce((prev) => prev + 1)
  }, [])

  useEffect(() => {
    retryAutoCreateRef.current = retryAutoCreate
  }, [retryAutoCreate])

  useEffect(() => {
    if (!autoCreateRequested) {
      return
    }
    if (!authUserId) {
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const payload = buildDefaultApiKeyPayload({})
        const result = await ensureInitialApiKeyCreateOnce({
          scopeKey: `user:${authUserId}`,
          ensureInitialKey: () => ensureInitialApiKey(payload),
          onCreated: trackYahooApiKeyCreatedConversion,
        })

        if (cancelled) return

        if (result.status === 'created') {
          setAutoRevealKey(result.key)
          triggerRefresh()
        } else if (result.status === 'create-failed') {
          toast.error(
            result.message || tRef.current(ERROR_MESSAGES.CREATE_FAILED),
            {
              action: {
                label: tRef.current('Retry'),
                onClick: retryAutoCreateRef.current,
              },
            }
          )
        }

        if (result.consumeSearch) {
          onAutoCreateConsumedRef.current?.()
          resetInitialApiKeyCreateOnce()
        }
      } catch {
        if (!cancelled) {
          toast.error(tRef.current(ERROR_MESSAGES.UNEXPECTED), {
            action: {
              label: tRef.current('Retry'),
              onClick: retryAutoCreateRef.current,
            },
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authUserId, autoCreateRetryNonce, autoCreateRequested, triggerRefresh])

  const resolveRealKey = useCallback(
    async (id: number): Promise<string | null> => {
      if (resolvedKeys[id]) return resolvedKeys[id]
      if (id in pendingRequests.current) return pendingRequests.current[id]

      const request = (async () => {
        setLoadingKeys((prev) => ({ ...prev, [id]: true }))
        try {
          const res = await fetchTokenKey(id)
          if (res.success && res.data?.key) {
            const fullKey = `sk-${res.data.key}`
            setResolvedKeys((prev) => ({ ...prev, [id]: fullKey }))
            return fullKey
          }
          toast.error(res.message || t(ERROR_MESSAGES.UNEXPECTED))
          return null
        } catch {
          toast.error(t(ERROR_MESSAGES.UNEXPECTED))
          return null
        } finally {
          delete pendingRequests.current[id]
          setLoadingKeys((prev) => {
            const next = { ...prev }
            delete next[id]
            return next
          })
        }
      })()

      pendingRequests.current[id] = request
      return request
    },
    [resolvedKeys, t]
  )

  const resolveRealKeysBatch = useCallback(
    async (ids: number[]): Promise<Record<number, string>> => {
      const uncachedIds = ids.filter((id) => !resolvedKeys[id])
      if (uncachedIds.length === 0) {
        const result: Record<number, string> = {}
        for (const id of ids) result[id] = resolvedKeys[id]
        return result
      }

      for (const id of uncachedIds) {
        setLoadingKeys((prev) => ({ ...prev, [id]: true }))
      }

      try {
        const res = await fetchTokenKeysBatch(uncachedIds)
        if (res.success && res.data?.keys) {
          const newKeys: Record<number, string> = {}
          for (const [idStr, key] of Object.entries(res.data.keys)) {
            newKeys[Number(idStr)] = `sk-${key}`
          }
          setResolvedKeys((prev) => ({ ...prev, ...newKeys }))

          const result: Record<number, string> = { ...newKeys }
          for (const id of ids) {
            if (resolvedKeys[id]) result[id] = resolvedKeys[id]
          }
          return result
        }
        toast.error(res.message || t(ERROR_MESSAGES.UNEXPECTED))
        return {}
      } catch {
        toast.error(t(ERROR_MESSAGES.UNEXPECTED))
        return {}
      } finally {
        for (const id of uncachedIds) {
          setLoadingKeys((prev) => {
            const next = { ...prev }
            delete next[id]
            return next
          })
        }
      }
    },
    [resolvedKeys, t]
  )

  return (
    <ApiKeysContext
      value={{
        open,
        setOpen,
        currentRow,
        setCurrentRow,
        refreshTrigger,
        triggerRefresh,
        resolvedKey,
        setResolvedKey,
        resolveRealKey,
        resolveRealKeysBatch,
        resolvedKeys,
        loadingKeys,
        copiedKeyId,
        markKeyCopied,
        initialCreateGroup,
        createRequestKey,
        createRequestedGroup: createDialogRequested
          ? props.requestedCreateGroup
          : undefined,
        modelAccessQuery,
      }}
    >
      {props.children}
      <ApiKeyRevealDialog
        open={!!autoRevealKey}
        onOpenChange={(isOpen) => !isOpen && setAutoRevealKey(null)}
        apiKey={autoRevealKey ?? ''}
      />
    </ApiKeysContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useApiKeys = () => {
  const apiKeysContext = React.useContext(ApiKeysContext)

  if (!apiKeysContext) {
    throw new Error('useApiKeys has to be used within <ApiKeysContext>')
  }

  return apiKeysContext
}
