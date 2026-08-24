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
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  clearCurrentPlaygroundRecord,
  getCurrentPlaygroundRecord,
  savePlaygroundRecord,
} from '../api'
import {
  buildPlaygroundRecordPayload,
  browserPlaygroundOutbox,
  clearLocalConversationPriority,
  createActivePlaygroundTurn,
  drainPlaygroundOutbox,
  loadLocalConversationPriority,
  restorePlaygroundSession,
  saveLocalConversationPriority,
  type ActivePlaygroundTurn,
} from '../lib'
import type {
  Message,
  ParameterEnabled,
  PlaygroundConfig,
  PlaygroundRecordPayload,
} from '../types'

type MessageUpdater = Message[] | ((previous: Message[]) => Message[])

interface UsePlaygroundPersistenceOptions {
  userId?: number
  messages: Message[]
  conversationId: string
  setConversationId: (conversationId: string) => void
  updateMessages: (updater: MessageUpdater) => void
}

interface UserActiveTurn {
  userId: number
  turn: ActivePlaygroundTurn
}

function isAuthenticatedUserId(userId?: number): userId is number {
  return typeof userId === 'number' && Number.isInteger(userId) && userId > 0
}

export function usePlaygroundPersistence({
  userId,
  messages,
  conversationId,
  setConversationId,
  updateMessages,
}: UsePlaygroundPersistenceOptions) {
  const activeTurnRef = useRef<UserActiveTurn | null>(null)
  const stoppedRef = useRef(false)
  const messagesRef = useRef(messages)
  const conversationIdRef = useRef(conversationId)
  const drainPromiseRef = useRef<Promise<PlaygroundRecordPayload[]> | null>(
    null
  )
  const [settledUserId, setSettledUserId] = useState<number | null>(null)
  const hasUser = isAuthenticatedUserId(userId)
  const isRestoring = hasUser && settledUserId !== userId

  useEffect(() => {
    messagesRef.current = messages
    conversationIdRef.current = conversationId
  }, [conversationId, messages])

  const clearDeliveredLocalPriority = useCallback(
    (targetUserId: number, deliveredRecords: PlaygroundRecordPayload[]) => {
      const priority = loadLocalConversationPriority(targetUserId)
      if (
        priority &&
        deliveredRecords.some(
          (record) =>
            record.conversation_id === priority.conversationId &&
            record.client_completed_at >= priority.markedAt
        )
      ) {
        clearLocalConversationPriority(targetUserId)
      }
    },
    []
  )

  const drainStoredRecords = useCallback(
    async (targetUserId: number) => {
      if (drainPromiseRef.current) return drainPromiseRef.current

      const drain = async () => {
        while (true) {
          const attemptedRecords =
            await browserPlaygroundOutbox.list(targetUserId)
          if (attemptedRecords.length === 0) return []

          const remainingRecords = await drainPlaygroundOutbox(
            attemptedRecords,
            savePlaygroundRecord
          )
          const deliveredCount =
            attemptedRecords.length - remainingRecords.length
          await browserPlaygroundOutbox.remove(
            targetUserId,
            attemptedRecords
              .slice(0, deliveredCount)
              .map((record) => record.record_id)
          )
          clearDeliveredLocalPriority(
            targetUserId,
            attemptedRecords.slice(0, deliveredCount)
          )
          if (remainingRecords.length > 0) return remainingRecords
        }
      }

      drainPromiseRef.current = drain()
      try {
        return await drainPromiseRef.current
      } finally {
        drainPromiseRef.current = null
      }
    },
    [clearDeliveredLocalPriority]
  )

  useEffect(() => {
    activeTurnRef.current = null
    stoppedRef.current = false
    let cancelled = false

    if (!hasUser) {
      queueMicrotask(() => {
        if (!cancelled) setSettledUserId(null)
      })
      return () => {
        cancelled = true
      }
    }

    const restore = async () => {
      const attemptedRecords = await browserPlaygroundOutbox.list(userId)
      const priority = loadLocalConversationPriority(userId)
      const result = await restorePlaygroundSession(
        attemptedRecords,
        savePlaygroundRecord,
        getCurrentPlaygroundRecord,
        {
          preferLocal:
            !!priority &&
            priority.conversationId === conversationIdRef.current &&
            messagesRef.current.length > 0,
        }
      )
      const deliveredCount =
        attemptedRecords.length - result.pendingRecords.length
      await browserPlaygroundOutbox.remove(
        userId,
        attemptedRecords
          .slice(0, deliveredCount)
          .map((record) => record.record_id)
      )
      clearDeliveredLocalPriority(
        userId,
        attemptedRecords.slice(0, deliveredCount)
      )

      if (cancelled || !result.shouldApplyCurrent) return

      if (result.current) {
        setConversationId(result.current.conversation_id)
        updateMessages(result.current.messages)
      } else {
        updateMessages([])
        setConversationId(crypto.randomUUID())
      }
    }

    void restore().finally(() => {
      if (!cancelled) setSettledUserId(userId)
    })

    return () => {
      cancelled = true
    }
  }, [
    clearDeliveredLocalPriority,
    hasUser,
    setConversationId,
    updateMessages,
    userId,
  ])

  useEffect(() => {
    const active = activeTurnRef.current
    if (!active || !hasUser || active.userId !== userId) return

    const assistantMessage = messages.find(
      (message) => message.key === active.turn.assistantMessageKey
    )
    if (
      assistantMessage?.from !== 'assistant' ||
      (assistantMessage.status !== 'complete' &&
        assistantMessage.status !== 'error')
    ) {
      return
    }

    const payload = buildPlaygroundRecordPayload(
      active.turn,
      messages,
      stoppedRef.current
    )
    activeTurnRef.current = null
    stoppedRef.current = false
    void (async () => {
      const durability = await browserPlaygroundOutbox.enqueue(userId, payload)
      const remaining = await drainStoredRecords(userId)
      if (durability === 'volatile' && remaining.length > 0) {
        toast.warning(
          'This Playground record could not be stored in the browser. Keep this page open while it retries.'
        )
      }
    })()
  }, [drainStoredRecords, hasUser, messages, userId])

  const startTurn = useCallback(
    (
      requestMessages: Message[],
      effectiveConfig: PlaygroundConfig,
      parameterEnabled: ParameterEnabled,
      minimalParameters: boolean,
      assistantMessageKey: string
    ) => {
      if (!hasUser || !conversationId) return

      activeTurnRef.current = {
        userId,
        turn: createActivePlaygroundTurn(
          conversationId,
          requestMessages,
          effectiveConfig,
          parameterEnabled,
          minimalParameters,
          assistantMessageKey
        ),
      }
      stoppedRef.current = false
    },
    [conversationId, hasUser, userId]
  )

  const markActiveTurnStopped = useCallback(() => {
    if (activeTurnRef.current) stoppedRef.current = true
  }, [])

  const markCurrentConversationLocalOnly = useCallback(() => {
    if (!hasUser || !conversationId) return
    saveLocalConversationPriority(userId, {
      conversationId,
      markedAt: Date.now(),
    })
  }, [conversationId, hasUser, userId])

  const clearCurrentConversation = useCallback(async (): Promise<boolean> => {
    if (!hasUser || !conversationId) return false

    try {
      await clearCurrentPlaygroundRecord(
        crypto.randomUUID(),
        conversationId,
        Date.now()
      )
    } catch {
      return false
    }

    activeTurnRef.current = null
    stoppedRef.current = false
    updateMessages([])
    setConversationId(crypto.randomUUID())
    return true
  }, [conversationId, hasUser, setConversationId, updateMessages])

  return {
    isRestoring,
    startTurn,
    markActiveTurnStopped,
    markCurrentConversationLocalOnly,
    clearCurrentConversation,
  }
}
