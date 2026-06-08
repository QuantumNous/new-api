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
import { useState, useCallback } from 'react'
import {
  DEFAULT_CONFIG,
  DEFAULT_IMAGE_CONFIG,
  DEFAULT_PARAMETER_ENABLED,
} from '../constants'
import {
  loadImageConfig,
  loadImageTasks,
  loadConfig,
  saveConfig,
  saveImageConfig,
  saveImageTasks,
  loadParameterEnabled,
  saveParameterEnabled,
  loadPlaygroundMode,
  savePlaygroundMode,
  loadMessages,
  saveMessages,
} from '../lib'
import type {
  ImageGenerationConfig,
  ImageTask,
  Message,
  PlaygroundConfig,
  PlaygroundMode,
  ParameterEnabled,
  ModelOption,
  GroupOption,
} from '../types'

/**
 * Main state management hook for playground
 */
export function usePlaygroundState() {
  const [mode, setModeState] = useState<PlaygroundMode>(() => {
    return loadPlaygroundMode()
  })

  // Load initial state from localStorage
  const [config, setConfig] = useState<PlaygroundConfig>(() => {
    const savedConfig = loadConfig()
    return { ...DEFAULT_CONFIG, ...savedConfig }
  })

  const [imageConfig, setImageConfig] = useState<ImageGenerationConfig>(() => {
    const savedConfig = loadImageConfig()
    return { ...DEFAULT_IMAGE_CONFIG, ...savedConfig }
  })

  const [parameterEnabled, setParameterEnabled] = useState<ParameterEnabled>(
    () => {
      const saved = loadParameterEnabled()
      return { ...DEFAULT_PARAMETER_ENABLED, ...saved }
    }
  )

  const [messages, setMessages] = useState<Message[]>(() => {
    return loadMessages() || []
  })

  const [imageTasks, setImageTasks] = useState<ImageTask[]>(() => {
    return loadImageTasks()
  })

  const [models, setModels] = useState<ModelOption[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])

  // Update config with automatic save
  const setMode = useCallback((value: PlaygroundMode) => {
    setModeState(value)
    savePlaygroundMode(value)
  }, [])

  // Update config with automatic save
  const updateConfig = useCallback(
    <K extends keyof PlaygroundConfig>(key: K, value: PlaygroundConfig[K]) => {
      setConfig((prev) => {
        const updated = { ...prev, [key]: value }
        saveConfig(updated)
        return updated
      })
    },
    []
  )

  const updateImageConfig = useCallback(
    <K extends keyof ImageGenerationConfig>(
      key: K,
      value: ImageGenerationConfig[K]
    ) => {
      setImageConfig((prev) => {
        const updated = { ...prev, [key]: value }
        saveImageConfig(updated)
        return updated
      })
    },
    []
  )

  // Update parameter enabled with automatic save
  const updateParameterEnabled = useCallback(
    (key: keyof ParameterEnabled, value: boolean) => {
      setParameterEnabled((prev) => {
        const updated = { ...prev, [key]: value }
        saveParameterEnabled(updated)
        return updated
      })
    },
    []
  )

  // Update messages with automatic save
  const updateMessages = useCallback(
    (updater: Message[] | ((prev: Message[]) => Message[])) => {
      setMessages((prev) => {
        const newMessages =
          typeof updater === 'function' ? updater(prev) : updater
        saveMessages(newMessages)
        return newMessages
      })
    },
    []
  )

  const updateImageTasks = useCallback(
    (updater: ImageTask[] | ((prev: ImageTask[]) => ImageTask[])) => {
      setImageTasks((prev) => {
        const newTasks =
          typeof updater === 'function' ? updater(prev) : updater
        saveImageTasks(newTasks)
        return newTasks
      })
    },
    []
  )

  // Clear all messages
  const clearMessages = useCallback(() => {
    updateMessages([])
  }, [updateMessages])

  // Reset config to defaults
  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG)
    setImageConfig(DEFAULT_IMAGE_CONFIG)
    setParameterEnabled(DEFAULT_PARAMETER_ENABLED)
    saveConfig(DEFAULT_CONFIG)
    saveImageConfig(DEFAULT_IMAGE_CONFIG)
    saveParameterEnabled(DEFAULT_PARAMETER_ENABLED)
  }, [])

  return {
    // State
    mode,
    config,
    imageConfig,
    parameterEnabled,
    messages,
    imageTasks,
    models,
    groups,

    // Setters
    setModels,
    setGroups,

    // Actions
    setMode,
    updateConfig,
    updateImageConfig,
    updateParameterEnabled,
    updateMessages,
    updateImageTasks,
    clearMessages,
    resetConfig,
  }
}
