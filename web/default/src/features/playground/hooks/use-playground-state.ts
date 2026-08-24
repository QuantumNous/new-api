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
import { useCallback, useLayoutEffect, useState } from 'react'
import { DEFAULT_CONFIG, DEFAULT_PARAMETER_ENABLED } from '../constants'
import {
  loadConfig,
  saveConfig,
  loadParameterEnabled,
  saveParameterEnabled,
  loadMessages,
  saveMessages,
  applyPlaygroundHandoffModel,
  createPlaygroundId,
  loadConversationId,
  saveConversationId,
} from '../lib'
import type {
  Message,
  PlaygroundConfig,
  ParameterEnabled,
  ModelOption,
  GroupOption,
} from '../types'

/**
 * Main state management hook for playground
 */
export function usePlaygroundState(userId?: number, initialModel?: string) {
  const hasUser = typeof userId === 'number' && userId > 0

  // Load initial state from localStorage
  const [config, setConfig] = useState<PlaygroundConfig>(() => {
    const savedConfig = hasUser ? loadConfig(userId) : {}
    return applyPlaygroundHandoffModel(
      { ...DEFAULT_CONFIG, ...savedConfig },
      initialModel
    )
  })

  const [parameterEnabled, setParameterEnabled] = useState<ParameterEnabled>(
    () => {
      const saved = hasUser ? loadParameterEnabled(userId) : {}
      return { ...DEFAULT_PARAMETER_ENABLED, ...saved }
    }
  )

  const [messages, setMessages] = useState<Message[]>(() => {
    return hasUser ? loadMessages(userId) || [] : []
  })

  const [conversationId, setConversationIdState] = useState<string>(() => {
    return hasUser ? loadConversationId(userId) || createPlaygroundId() : ''
  })

  const [models, setModels] = useState<ModelOption[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])

  /* eslint-disable react-hooks/set-state-in-effect -- Account changes must replace the user-scoped cache before the browser paints stale data. */
  useLayoutEffect(() => {
    if (!hasUser) {
      setConfig(applyPlaygroundHandoffModel(DEFAULT_CONFIG, initialModel))
      setParameterEnabled(DEFAULT_PARAMETER_ENABLED)
      setMessages([])
      setConversationIdState('')
      return
    }

    setConfig(
      applyPlaygroundHandoffModel(
        { ...DEFAULT_CONFIG, ...loadConfig(userId) },
        initialModel
      )
    )
    setParameterEnabled({
      ...DEFAULT_PARAMETER_ENABLED,
      ...loadParameterEnabled(userId),
    })
    setMessages(loadMessages(userId) || [])

    const savedConversationId = loadConversationId(userId)
    const nextConversationId = savedConversationId || createPlaygroundId()
    setConversationIdState(nextConversationId)
    if (!savedConversationId) {
      saveConversationId(userId, nextConversationId)
    }
  }, [hasUser, initialModel, userId])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Update config with automatic save
  const updateConfig = useCallback(
    <K extends keyof PlaygroundConfig>(key: K, value: PlaygroundConfig[K]) => {
      setConfig((prev) => {
        const updated = { ...prev, [key]: value }
        if (hasUser) saveConfig(userId, updated)
        return updated
      })
    },
    [hasUser, userId]
  )

  // Update parameter enabled with automatic save
  const updateParameterEnabled = useCallback(
    (key: keyof ParameterEnabled, value: boolean) => {
      setParameterEnabled((prev) => {
        const updated = { ...prev, [key]: value }
        if (hasUser) saveParameterEnabled(userId, updated)
        return updated
      })
    },
    [hasUser, userId]
  )

  // Update messages with automatic save
  const updateMessages = useCallback(
    (updater: Message[] | ((prev: Message[]) => Message[])) => {
      setMessages((prev) => {
        const newMessages =
          typeof updater === 'function' ? updater(prev) : updater
        if (hasUser) saveMessages(userId, newMessages)
        return newMessages
      })
    },
    [hasUser, userId]
  )

  const setConversationId = useCallback(
    (nextConversationId: string) => {
      setConversationIdState(nextConversationId)
      if (hasUser) saveConversationId(userId, nextConversationId)
    },
    [hasUser, userId]
  )

  // Clear all messages
  const clearMessages = useCallback(() => {
    updateMessages([])
  }, [updateMessages])

  // Reset config to defaults
  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG)
    setParameterEnabled(DEFAULT_PARAMETER_ENABLED)
    if (hasUser) {
      saveConfig(userId, DEFAULT_CONFIG)
      saveParameterEnabled(userId, DEFAULT_PARAMETER_ENABLED)
    }
  }, [hasUser, userId])

  return {
    // State
    config,
    parameterEnabled,
    messages,
    conversationId,
    models,
    groups,

    // Setters
    setModels,
    setGroups,
    setConversationId,

    // Actions
    updateConfig,
    updateParameterEnabled,
    updateMessages,
    clearMessages,
    resetConfig,
  }
}
