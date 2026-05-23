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
import type { ChatPreset } from './chat-links'

/** Phase-1: hide third-party external client entries in the UI only. */
export const HIDDEN_EXTERNAL_CHAT_CLIENT_NAMES = [
  'Cherry Studio',
  'AionUI',
  'CC Switch',
  'DeepChat',
  'Lobe Chat',
  'AI as Workspace',
  'AMA 问天',
  'OpenCat',
] as const

const HIDDEN_NAME_PATTERNS = [
  /^cherry\s*studio/i,
  /^aion\s*ui/i,
  /^cc\s*switch/i,
  /^deep\s*chat/i,
  /^lobe\s*chat/i,
  /^ai\s*as\s*workspace/i,
  /^ama\s*问天/i,
  /^opencat/i,
]

const HIDDEN_URL_PATTERNS = [
  /lobehub\.com/i,
  /lobe-chat/i,
  /cherry-ai/i,
  /cherrystudio/i,
  /deepchat/i,
  /opencat/i,
  /aionui/i,
  /cc-switch/i,
  /ccswitch/i,
  /\{cherryconfig\}/i,
  /\{aionuiconfig\}/i,
  /\{deepchatconfig\}/i,
  /fluent:/i,
]

function normalizeClientName(name: string): string {
  return name.trim().toLowerCase()
}

export function isHiddenExternalChatClient(
  name: string,
  url?: string
): boolean {
  const normalized = normalizeClientName(name)

  if (
    HIDDEN_EXTERNAL_CHAT_CLIENT_NAMES.some(
      (hidden) =>
        normalized === hidden.toLowerCase() ||
        normalized.startsWith(`${hidden.toLowerCase()} `) ||
        normalized.startsWith(hidden.toLowerCase())
    )
  ) {
    return true
  }

  if (HIDDEN_NAME_PATTERNS.some((pattern) => pattern.test(name.trim()))) {
    return true
  }

  if (url) {
    const normalizedUrl = url.trim().toLowerCase()
    if (HIDDEN_URL_PATTERNS.some((pattern) => pattern.test(normalizedUrl))) {
      return true
    }
  }

  return false
}

export function filterVisibleChatPresets(presets: ChatPreset[]): ChatPreset[] {
  return presets.filter(
    (preset) => !isHiddenExternalChatClient(preset.name, preset.url)
  )
}
