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
import { STORAGE_KEYS } from '../constants'
import type {
  ImageGenerationConfig,
  ImageTask,
  Message,
  ParameterEnabled,
  PlaygroundConfig,
  PlaygroundMode,
} from '../types'
import { sanitizeMessagesOnLoad } from './message-utils'

const MAX_IMAGE_TASKS = 20
const MAX_PERSISTED_BASE64_IMAGES = 4

/**
 * Load playground config from localStorage
 */
export function loadConfig(): Partial<PlaygroundConfig> {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CONFIG)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load config:', error)
  }
  return {}
}

/**
 * Save playground config to localStorage
 */
export function saveConfig(config: Partial<PlaygroundConfig>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save config:', error)
  }
}

/**
 * Load parameter enabled state from localStorage
 */
export function loadParameterEnabled(): Partial<ParameterEnabled> {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.PARAMETER_ENABLED)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load parameter enabled:', error)
  }
  return {}
}

/**
 * Save parameter enabled state to localStorage
 */
export function saveParameterEnabled(
  parameterEnabled: Partial<ParameterEnabled>
): void {
  try {
    localStorage.setItem(
      STORAGE_KEYS.PARAMETER_ENABLED,
      JSON.stringify(parameterEnabled)
    )
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save parameter enabled:', error)
  }
}

/**
 * Load messages from localStorage
 */
export function loadMessages(): Message[] | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES)
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      if (!Array.isArray(parsed)) {
        return null
      }
      const sanitized = sanitizeMessagesOnLoad(parsed as Message[])
      // Persist sanitized result to avoid re-sanitizing on subsequent loads
      if (sanitized !== parsed) {
        saveMessages(sanitized)
      }
      return sanitized
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load messages:', error)
  }
  return null
}

/**
 * Save messages to localStorage
 */
export function saveMessages(messages: Message[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save messages:', error)
  }
}

export function loadPlaygroundMode(): PlaygroundMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.MODE)
    if (saved === 'chat' || saved === 'image') return saved
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load playground mode:', error)
  }
  return 'chat'
}

export function savePlaygroundMode(mode: PlaygroundMode): void {
  try {
    localStorage.setItem(STORAGE_KEYS.MODE, mode)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save playground mode:', error)
  }
}

export function loadImageConfig(): Partial<ImageGenerationConfig> {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.IMAGE_CONFIG)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load image config:', error)
  }
  return {}
}

export function saveImageConfig(config: Partial<ImageGenerationConfig>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.IMAGE_CONFIG, JSON.stringify(config))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save image config:', error)
  }
}

function sanitizeImageTasksForStorage(tasks: ImageTask[]): ImageTask[] {
  let persistedBase64Count = 0

  return tasks.slice(0, MAX_IMAGE_TASKS).map((task) => {
    const status =
      task.status === 'running' ? ('interrupted' as const) : task.status
    const error =
      task.status === 'running' ? 'Generation was interrupted' : task.error
    const finishedAt =
      task.status === 'running'
        ? (task.finishedAt ?? Date.now())
        : task.finishedAt

    let image = task.image
    if (image?.b64_json) {
      persistedBase64Count += 1
      if (persistedBase64Count > MAX_PERSISTED_BASE64_IMAGES) {
        image = {
          revised_prompt: image.revised_prompt,
        }
      }
    }

    const sanitized: ImageTask = {
      id: task.id,
      prompt: task.prompt,
      config: task.config,
      status,
      createdAt: task.createdAt,
    }

    if (task.mode) sanitized.mode = task.mode
    if (task.referenceImages) {
      sanitized.referenceImages = task.referenceImages.map((image) => ({
        id: image.id,
        name: image.name,
        dataUrl: image.dataUrl,
        type: image.type,
        size: image.size,
      }))
    }
    if (image) sanitized.image = image
    if (error) sanitized.error = error
    if (task.errorCode) sanitized.errorCode = task.errorCode
    if (finishedAt) sanitized.finishedAt = finishedAt

    return sanitized
  })
}

export function loadImageTasks(): ImageTask[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.IMAGE_TASKS)
    if (!saved) return []

    const parsed: unknown = JSON.parse(saved)
    if (!Array.isArray(parsed)) return []

    const sanitized = sanitizeImageTasksForStorage(parsed as ImageTask[])
    if (JSON.stringify(sanitized) !== saved) {
      saveImageTasks(sanitized)
    }
    return sanitized
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load image tasks:', error)
    return []
  }
}

export function saveImageTasks(tasks: ImageTask[]): void {
  try {
    const sanitized = sanitizeImageTasksForStorage(tasks)
    localStorage.setItem(STORAGE_KEYS.IMAGE_TASKS, JSON.stringify(sanitized))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save image tasks:', error)
  }
}

/**
 * Clear all playground data
 */
export function clearPlaygroundData(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.CONFIG)
    localStorage.removeItem(STORAGE_KEYS.IMAGE_CONFIG)
    localStorage.removeItem(STORAGE_KEYS.IMAGE_TASKS)
    localStorage.removeItem(STORAGE_KEYS.MODE)
    localStorage.removeItem(STORAGE_KEYS.PARAMETER_ENABLED)
    localStorage.removeItem(STORAGE_KEYS.MESSAGES)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to clear playground data:', error)
  }
}
