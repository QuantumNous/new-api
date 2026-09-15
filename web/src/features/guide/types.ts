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
export type GuideDocSlug =
  | 'quick-start'
  | 'essentials'
  | 'claude-code'
  | 'codex'
  | 'cc-switch'
  | 'cherry-studio'
  | 'troubleshooting'

export type GuidePlatform =
  | 'windows'
  | 'macos'
  | 'linux'
  | 'vscode'
  | 'jetbrains'

export type GuideAudience = 'all' | 'openai' | 'openai-response' | 'anthropic'

export type GuideGroup = 'start' | 'coding' | 'desktop' | 'help'

export type GuideRuntime = {
  host: string
  baseUrl: string
  fullUrl: string
  model: string
  group: string
  platform: GuidePlatform
  contextLength?: number
  verified: boolean
}

export type GuideSearch = {
  q?: string
  platform?: GuidePlatform
  model?: string
  group?: string
}

export type GuideCode = {
  label: string
  language: string
  template: string
  copyLabel?: string
}

export type GuideAction = {
  label: string
  to: '/keys' | '/pricing' | '/playground'
}

export type GuideStep = {
  title: string
  text?: string
  code?: GuideCode
  action?: GuideAction
}

export type GuideBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'steps'; items: GuideStep[] }
  | ({ type: 'code' } & GuideCode)
  | {
      type: 'callout'
      tone: 'info' | 'warning'
      title: string
      text: string
    }
  | { type: 'table'; columns: string[]; rows: string[][] }
  | {
      type: 'platform'
      platforms: Partial<Record<GuidePlatform, GuideBlock[]>>
    }
  | {
      type: 'context-window'
      supportedTitle: string
      supportedText: string
      unavailableTitle: string
      unavailableText: string
    }

export type GuideSection = {
  id: string
  title: string
  blocks: GuideBlock[]
}

export type GuideDoc = {
  slug: GuideDocSlug
  group: GuideGroup
  title: string
  summary: string
  audience: GuideAudience
  readingMinutes: number
  sections: GuideSection[]
}

export type GuideSearchHit = {
  id: string
  slug: GuideDocSlug
  sectionId: string
  title: string
  snippet: string
}
