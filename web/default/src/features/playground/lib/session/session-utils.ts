/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { nanoid } from 'nanoid'

import type { Message } from '../../types'
import {
  MAX_LOCAL_SESSIONS,
  MAX_SESSION_MESSAGES,
  type ActiveSessionByModality,
  type ChatSession,
  type PlaygroundSession,
  type SessionModality,
  type StudioSession,
} from './session-types'

function now(): number {
  return Date.now()
}

export function createSessionId(): string {
  return `s_${nanoid(10)}`
}

export function defaultSessionTitle(modality: SessionModality): string {
  if (modality === 'chat') return 'New chat'
  if (modality === 'image') return 'Untitled image project'
  if (modality === 'video') return 'Untitled video project'
  return 'Untitled audio project'
}

export function createChatSession(input?: {
  id?: string
  title?: string
  model?: string
  group?: string
  messages?: Message[]
  serverId?: number
  isDraft?: boolean
  draft?: string
  kind?: 'chat' | 'duo'
  duoMeta?: ChatSession['duoMeta']
  createdAt?: number
  updatedAt?: number
}): ChatSession {
  const ts = now()
  const messages = (input?.messages ?? []).slice(-MAX_SESSION_MESSAGES)
  return {
    id: input?.id ?? createSessionId(),
    serverId: input?.serverId,
    modality: 'chat',
    title: input?.title?.trim() || defaultSessionTitle('chat'),
    model: input?.model ?? '',
    group: input?.group ?? '',
    messages,
    kind: input?.kind ?? 'chat',
    duoMeta: input?.duoMeta,
    draft: input?.draft,
    isDraft: input?.isDraft ?? messages.length === 0,
    createdAt: input?.createdAt ?? ts,
    updatedAt: input?.updatedAt ?? ts,
  }
}

export function createStudioSession(
  modality: 'image' | 'video' | 'audio',
  input?: {
    id?: string
    title?: string
    model?: string
    group?: string
    previewUrls?: string[]
    lastPrompt?: string
    isDraft?: boolean
    draft?: string
    serverId?: number
    runs?: StudioSession['runs']
    createdAt?: number
    updatedAt?: number
  }
): StudioSession {
  const ts = now()
  const hasContent = Boolean(
    input?.lastPrompt?.trim() ||
    (input?.previewUrls && input.previewUrls.length > 0) ||
    (input?.runs && input.runs.length > 0)
  )
  return {
    id: input?.id ?? createSessionId(),
    serverId: input?.serverId,
    modality,
    title: input?.title?.trim() || defaultSessionTitle(modality),
    model: input?.model ?? '',
    group: input?.group ?? '',
    previewUrls: input?.previewUrls,
    lastPrompt: input?.lastPrompt,
    runs: input?.runs,
    draft: input?.draft,
    isDraft: input?.isDraft ?? !hasContent,
    createdAt: input?.createdAt ?? ts,
    updatedAt: input?.updatedAt ?? ts,
  }
}

export function createEmptySession(
  modality: SessionModality,
  model = '',
  group = ''
): PlaygroundSession {
  if (modality === 'chat') {
    return createChatSession({ model, group, isDraft: true })
  }
  return createStudioSession(modality, { model, group, isDraft: true })
}

export function isChatSession(
  session: PlaygroundSession | null | undefined
): session is ChatSession {
  return session?.modality === 'chat'
}

export function isStudioSession(
  session: PlaygroundSession | null | undefined
): session is StudioSession {
  return (
    session != null &&
    (session.modality === 'image' ||
      session.modality === 'video' ||
      session.modality === 'audio')
  )
}

export function titleFromFirstUserMessage(messages: Message[]): string | null {
  for (const message of messages) {
    if (message.from !== 'user') continue
    const text = message.versions[0]?.content?.trim()
    if (!text) continue
    return text.length > 48 ? `${text.slice(0, 48)}…` : text
  }
  return null
}

export function touchSession<T extends PlaygroundSession>(session: T): T {
  return { ...session, updatedAt: now() }
}

export function sortSessionsByUpdatedAt(
  sessions: PlaygroundSession[]
): PlaygroundSession[] {
  return [...sessions].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1
    return b.updatedAt - a.updatedAt
  })
}

export function listSessionsForModality(
  sessions: PlaygroundSession[],
  modality: SessionModality,
  options?: { includeDrafts?: boolean }
): PlaygroundSession[] {
  const includeDrafts = options?.includeDrafts === true
  return sortSessionsByUpdatedAt(
    sessions.filter((session) => {
      if (session.modality !== modality) return false
      if (!includeDrafts && session.isDraft && !hasSessionContent(session)) {
        return false
      }
      return true
    })
  )
}

export function hasSessionContent(session: PlaygroundSession): boolean {
  if (isChatSession(session)) {
    return session.messages.length > 0
  }
  return Boolean(
    session.lastPrompt?.trim() ||
    (session.previewUrls && session.previewUrls.length > 0) ||
    (session.runs && session.runs.length > 0)
  )
}

export function findSession(
  sessions: PlaygroundSession[],
  id: string | null | undefined
): PlaygroundSession | null {
  if (!id) return null
  return sessions.find((session) => session.id === id) ?? null
}

export function getActiveSession(
  sessions: PlaygroundSession[],
  activeByModality: ActiveSessionByModality,
  modality: SessionModality
): PlaygroundSession | null {
  return findSession(sessions, activeByModality[modality] ?? null)
}

export function pruneSessions(
  sessions: PlaygroundSession[]
): PlaygroundSession[] {
  const sorted = sortSessionsByUpdatedAt(sessions)
  if (sorted.length <= MAX_LOCAL_SESSIONS) return sorted
  // Prefer dropping empty drafts first.
  const keep: PlaygroundSession[] = []
  const drafts: PlaygroundSession[] = []
  for (const session of sorted) {
    if (session.isDraft && !hasSessionContent(session)) {
      drafts.push(session)
    } else {
      keep.push(session)
    }
  }
  const overflow = keep.length + drafts.length - MAX_LOCAL_SESSIONS
  if (overflow <= 0) return [...keep, ...drafts]
  const trimmedDrafts = drafts.slice(0, Math.max(0, drafts.length - overflow))
  const stillOver = keep.length + trimmedDrafts.length - MAX_LOCAL_SESSIONS
  const trimmedKeep =
    stillOver > 0 ? keep.slice(0, keep.length - stillOver) : keep
  return [...trimmedKeep, ...trimmedDrafts]
}

export function upsertSession(
  sessions: PlaygroundSession[],
  next: PlaygroundSession
): PlaygroundSession[] {
  const without = sessions.filter((session) => session.id !== next.id)
  return pruneSessions([next, ...without])
}

export function formatSessionTime(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return ''
  const date = new Date(timestamp)
  const diffMs = Date.now() - timestamp
  if (diffMs < 60_000) return 'Just now'
  if (diffMs < 3_600_000) {
    const mins = Math.max(1, Math.round(diffMs / 60_000))
    return `${mins}m ago`
  }
  if (diffMs < 86_400_000) {
    const hours = Math.max(1, Math.round(diffMs / 3_600_000))
    return `${hours}h ago`
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/** One-time import of the legacy global messages array into a chat session. */
export function importLegacyMessagesSession(input: {
  messages: Message[]
  model: string
  group: string
}): ChatSession | null {
  if (!input.messages.length) return null
  return createChatSession({
    title: 'Imported Playground chat',
    model: input.model,
    group: input.group,
    messages: input.messages,
    isDraft: false,
  })
}
