/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import type { Message, StudioModality } from '../../types'

/** Work-item modality — fixed for the lifetime of a session/project. */
export type SessionModality = StudioModality

export type PlaygroundSessionBase = {
  id: string
  /**
   * Cloud id when synced:
   * - chat/duo → playground_conversations.id
   * - studio → playground_projects.id
   */
  serverId?: number
  modality: SessionModality
  title: string
  /** Engine selected for the *next* turn / run inside this session. */
  model: string
  group: string
  createdAt: number
  updatedAt: number
  /** Unsent composer draft scoped to this session. */
  draft?: string
  /** True for empty drafts that should stay out of the history list. */
  isDraft?: boolean
  /** Pinned threads sort above the rest of the history list. */
  pinned?: boolean
}

/** Immutable studio generation attached to a project. */
export type StudioRunSummary = {
  id: number
  model?: string
  prompt?: string
  resultUrl?: string
  assetId?: number
  taskId?: string
  createdAt?: number
}

export type ChatSession = PlaygroundSessionBase & {
  modality: 'chat'
  messages: Message[]
  /** Multi-model (duo) session — same chat storage, different kind on server. */
  kind?: 'chat' | 'duo'
  duoMeta?: {
    answerModels: string[]
    summaryModel: string
  }
}

export type StudioSession = PlaygroundSessionBase & {
  modality: 'image' | 'video' | 'audio'
  /** Lightweight local run previews (URLs only; blobs excluded from persist). */
  previewUrls?: string[]
  lastPrompt?: string
  /** Cloud-linked immutable runs (newest last). */
  runs?: StudioRunSummary[]
}

export type PlaygroundSession = ChatSession | StudioSession

/** Last-open session id per modality. */
export type ActiveSessionByModality = Partial<
  Record<SessionModality, string | null>
>

export const SESSION_MODALITIES: SessionModality[] = [
  'chat',
  'image',
  'video',
  'audio',
]

export const MAX_LOCAL_SESSIONS = 80
export const MAX_SESSION_MESSAGES = 100
