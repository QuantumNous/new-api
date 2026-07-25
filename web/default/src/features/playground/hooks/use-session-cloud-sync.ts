/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useCallback, useEffect, useRef } from 'react'

import { usePlaygroundStore } from '@/stores/playground-store'

import {
  createConversation,
  createProject,
  deleteConversation,
  deleteProject,
  getConversation,
  getProject,
  listConversations,
  listProjects,
  putConversationMessages,
  updateConversation,
  updateProject,
  type PlaygroundRun,
  type ServerConversationMessageInput,
  type ServerMessage,
  type ServerProject,
} from '../api'
import {
  createChatSession,
  createStudioSession,
  getMessageContent,
  hasSessionContent,
  isChatSession,
  isStudioSession,
  type ChatSession,
  type PlaygroundSession,
  type StudioRunSummary,
  type StudioSession,
} from '../lib'
import type { Message } from '../types'

const SYNC_DEBOUNCE_MS = 1200

type ToolPayload = {
  managedTool?: Message['managedTool']
  sources?: Message['sources']
  modelChangeFrom?: string
  modelChangeTo?: string
  reasoning?: Message['reasoning']
}

function toServerMessages(
  messages: Message[]
): ServerConversationMessageInput[] {
  return messages
    .filter(
      (message) => message.from === 'user' || message.from === 'assistant'
    )
    .filter(
      (message) =>
        message.status !== 'loading' && message.status !== 'streaming'
    )
    .map((message) => {
      const tool: ToolPayload = {}
      if (message.managedTool) tool.managedTool = message.managedTool
      if (message.sources?.length) tool.sources = message.sources
      if (message.modelChangeFrom) {
        tool.modelChangeFrom = message.modelChangeFrom
      }
      if (message.modelChangeTo) tool.modelChangeTo = message.modelChangeTo
      if (message.reasoning) tool.reasoning = message.reasoning
      const hasTool = Object.keys(tool).length > 0
      return {
        role: message.from,
        content: getMessageContent(message),
        model: message.model || undefined,
        client_key: message.key,
        created_at:
          message.createdAt && message.createdAt > 1_000_000_000_000
            ? Math.floor(message.createdAt / 1000)
            : message.createdAt || undefined,
        tool_json: hasTool ? JSON.stringify(tool) : undefined,
      }
    })
}

function parseToolJson(raw?: string): ToolPayload {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as ToolPayload
  } catch {
    return {}
  }
}

function fromServerMessages(items: ServerMessage[]): Message[] {
  return items.map((item, index) => {
    let from: Message['from'] = 'user'
    if (item.role === 'assistant') from = 'assistant'
    else if (item.role === 'system') from = 'system'
    const tool = parseToolJson(item.tool_json)
    const createdAt =
      item.created_at && item.created_at < 1_000_000_000_000
        ? item.created_at * 1000
        : item.created_at || Date.now()
    return {
      key: item.client_key || `srv-${item.id || index}`,
      from,
      versions: [{ id: `v-${item.id || index}`, content: item.content || '' }],
      status: 'complete' as const,
      createdAt,
      model: item.model || undefined,
      managedTool: tool.managedTool,
      sources: tool.sources,
      modelChangeFrom: tool.modelChangeFrom,
      modelChangeTo: tool.modelChangeTo,
      reasoning: tool.reasoning,
    }
  })
}

function parsePreviewUrls(raw?: string): string[] | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return undefined
    return parsed
      .filter((item): item is string => typeof item === 'string')
      .slice(0, 12)
  } catch {
    return undefined
  }
}

function runsFromServer(runs: PlaygroundRun[]): StudioRunSummary[] {
  return runs.map((run) => ({
    id: run.id,
    model: run.model,
    prompt: run.prompt,
    resultUrl: run.result_url,
    assetId: run.asset_id,
    taskId: run.task_id,
    createdAt: run.created_at ? run.created_at * 1000 : undefined,
  }))
}

function studioFromServerProject(
  project: ServerProject,
  runs: PlaygroundRun[] = []
): StudioSession | null {
  if (
    project.modality !== 'image' &&
    project.modality !== 'video' &&
    project.modality !== 'audio'
  ) {
    return null
  }
  const previewUrls = parsePreviewUrls(project.preview_urls)
  const runSummaries = runsFromServer(runs)
  const fromRuns = runSummaries
    .map((run) => run.resultUrl)
    .filter((url): url is string => Boolean(url))
  const mergedPreviews = [...(previewUrls ?? []), ...fromRuns]
    .filter((url, index, all) => all.indexOf(url) === index)
    .slice(0, 12)
  return createStudioSession(project.modality, {
    id: project.client_key || `cloud_proj_${project.id}`,
    serverId: project.id,
    title: project.title || undefined,
    model: project.model || '',
    group: project.group || '',
    lastPrompt: project.last_prompt || undefined,
    previewUrls: mergedPreviews.length ? mergedPreviews : undefined,
    runs: runSummaries,
    isDraft: false,
    createdAt: (project.created_at || 0) * 1000 || Date.now(),
    updatedAt: (project.updated_at || 0) * 1000 || Date.now(),
  })
}

function patchSessionById(
  sessionId: string,
  patch: Partial<PlaygroundSession>
): void {
  const state = usePlaygroundStore.getState()
  usePlaygroundStore.setState({
    sessions: state.sessions.map((item) =>
      item.id === sessionId
        ? ({ ...item, ...patch } as PlaygroundSession)
        : item
    ),
  })
}

/**
 * Cloud sync for chat + studio sessions:
 * - Lazy-create server conversation/project on first meaningful content
 * - Debounced push of finalized chat messages / studio project metadata
 * - On login, merge remote conversations + projects into local sessions
 * - Best-effort delete of cloud records when a local session is removed
 */
export function useSessionCloudSync(isAuthenticated: boolean) {
  const sessions = usePlaygroundStore((state) => state.sessions)
  const timerRef = useRef<number | null>(null)
  const inflightRef = useRef(false)
  const importedRef = useRef(false)
  const knownIdsRef = useRef<Set<string>>(new Set())
  const serverBindingsRef = useRef<
    Map<string, { kind: 'chat' | 'project'; serverId: number }>
  >(new Map())

  const syncChatSession = useCallback(
    async (session: ChatSession) => {
      if (!isAuthenticated) return
      if (session.messages.length === 0) return
      const payload = toServerMessages(session.messages)
      if (payload.length === 0) return

      try {
        let serverId = session.serverId
        const kind = session.kind === 'duo' ? 'duo' : 'chat'
        const meta =
          kind === 'duo' && session.duoMeta
            ? {
                answerModels: session.duoMeta.answerModels,
                summaryModel: session.duoMeta.summaryModel,
              }
            : undefined
        if (!serverId) {
          const created = await createConversation({
            title: session.title,
            model: session.model,
            group: session.group,
            kind,
            meta_json: meta,
          })
          serverId = created.id
          patchSessionById(session.id, { serverId, isDraft: false })
          serverBindingsRef.current.set(session.id, {
            kind: 'chat',
            serverId,
          })
        } else {
          await updateConversation(serverId, {
            title: session.title,
            model: session.model,
            group: session.group,
            kind,
            meta_json: meta,
          })
        }
        if (serverId) {
          await putConversationMessages(serverId, payload)
        }
      } catch {
        // Offline / API errors are non-fatal; local session remains source of truth.
      }
    },
    [isAuthenticated]
  )

  const syncStudioSession = useCallback(
    async (session: StudioSession) => {
      if (!isAuthenticated) return
      if (!hasSessionContent(session)) return
      try {
        let serverId = session.serverId
        if (!serverId) {
          const created = await createProject({
            modality: session.modality,
            title: session.title,
            model: session.model,
            group: session.group,
            client_key: session.id,
            last_prompt: session.lastPrompt,
            preview_urls: session.previewUrls,
          })
          serverId = created.id
          patchSessionById(session.id, { serverId, isDraft: false })
          serverBindingsRef.current.set(session.id, {
            kind: 'project',
            serverId,
          })
        } else {
          await updateProject(serverId, {
            title: session.title,
            model: session.model,
            group: session.group,
            last_prompt: session.lastPrompt,
            preview_urls: session.previewUrls,
          })
        }
      } catch {
        // Best-effort.
      }
    },
    [isAuthenticated]
  )

  // Debounced push of active chat + studio sessions that have content.
  useEffect(() => {
    if (!isAuthenticated) return
    if (timerRef.current != null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      const state = usePlaygroundStore.getState()
      for (const session of state.sessions) {
        if (isChatSession(session) && session.messages.length > 0) {
          void syncChatSession(session)
        } else if (isStudioSession(session) && hasSessionContent(session)) {
          void syncStudioSession(session)
        }
      }
    }, SYNC_DEBOUNCE_MS)

    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
    }
  }, [isAuthenticated, sessions, syncChatSession, syncStudioSession])

  // Track deletions → best-effort cloud delete.
  useEffect(() => {
    if (!isAuthenticated) return
    const currentIds = new Set(sessions.map((session) => session.id))
    for (const session of sessions) {
      if (session.serverId) {
        serverBindingsRef.current.set(session.id, {
          kind: isChatSession(session) ? 'chat' : 'project',
          serverId: session.serverId,
        })
      }
      knownIdsRef.current.add(session.id)
    }
    const removedIds: string[] = []
    for (const prevId of knownIdsRef.current) {
      if (!currentIds.has(prevId)) removedIds.push(prevId)
    }
    for (const prevId of removedIds) {
      knownIdsRef.current.delete(prevId)
      const binding = serverBindingsRef.current.get(prevId)
      serverBindingsRef.current.delete(prevId)
      if (!binding) continue
      void (async () => {
        try {
          if (binding.kind === 'chat') {
            await deleteConversation(binding.serverId)
          } else {
            await deleteProject(binding.serverId)
          }
        } catch {
          // Ignore delete failures.
        }
      })()
    }
  }, [isAuthenticated, sessions])

  // One-shot pull of remote conversations + projects after login.
  useEffect(() => {
    if (!isAuthenticated || importedRef.current || inflightRef.current) return
    inflightRef.current = true
    void (async () => {
      try {
        const state = usePlaygroundStore.getState()
        const existingChatServerIds = new Set(
          state.sessions
            .filter(isChatSession)
            .map((session) => session.serverId)
            .filter((id): id is number => typeof id === 'number')
        )
        const existingProjectServerIds = new Set(
          state.sessions
            .filter(isStudioSession)
            .map((session) => session.serverId)
            .filter((id): id is number => typeof id === 'number')
        )
        const existingClientKeys = new Set(state.sessions.map((s) => s.id))
        const additions: PlaygroundSession[] = []

        const { items: convItems } = await listConversations({ page_size: 50 })
        for (const item of convItems.slice(0, 40)) {
          if (existingChatServerIds.has(item.id)) continue
          let messages: Message[] = []
          try {
            const detail = await getConversation(item.id)
            messages = fromServerMessages(detail.messages)
          } catch {
            messages = []
          }
          let duoMeta: ChatSession['duoMeta']
          if (item.meta_json) {
            try {
              const meta = JSON.parse(item.meta_json) as {
                answerModels?: string[]
                summaryModel?: string
              }
              if (Array.isArray(meta.answerModels)) {
                duoMeta = {
                  answerModels: meta.answerModels.filter(
                    (m): m is string => typeof m === 'string'
                  ),
                  summaryModel:
                    typeof meta.summaryModel === 'string'
                      ? meta.summaryModel
                      : '',
                }
              }
            } catch {
              duoMeta = undefined
            }
          }
          additions.push(
            createChatSession({
              id: `cloud_${item.id}`,
              serverId: item.id,
              title: item.title || 'Cloud chat',
              model: item.model || '',
              group: item.group || '',
              messages,
              kind: item.kind === 'duo' ? 'duo' : 'chat',
              duoMeta,
              isDraft: messages.length === 0,
              createdAt: (item.created_at || 0) * 1000 || Date.now(),
              updatedAt: (item.updated_at || 0) * 1000 || Date.now(),
            })
          )
        }

        const { items: projectItems } = await listProjects({ page_size: 50 })
        for (const item of projectItems.slice(0, 40)) {
          if (existingProjectServerIds.has(item.id)) continue
          if (item.client_key && existingClientKeys.has(item.client_key)) {
            // Bind local session to cloud id without duplicating.
            const local = state.sessions.find((s) => s.id === item.client_key)
            if (local && isStudioSession(local) && !local.serverId) {
              patchSessionById(local.id, { serverId: item.id, isDraft: false })
              existingProjectServerIds.add(item.id)
            }
            continue
          }
          let runs: PlaygroundRun[] = []
          try {
            const detail = await getProject(item.id)
            runs = detail.runs ?? []
          } catch {
            runs = []
          }
          const session = studioFromServerProject(item, runs)
          if (session) additions.push(session)
        }

        if (additions.length > 0) {
          const latest = usePlaygroundStore.getState()
          usePlaygroundStore.setState({
            sessions: [...additions, ...latest.sessions],
          })
        }
        importedRef.current = true
      } catch {
        // Ignore list failures; user can still work offline.
      } finally {
        inflightRef.current = false
      }
    })()
  }, [isAuthenticated])
}

/** Ensure the active studio session is cloud-bound; returns project id or 0. */
export async function ensureActiveStudioProjectId(): Promise<number> {
  const state = usePlaygroundStore.getState()
  const session = state.sessions.find(
    (item) => item.id === state.activeSessionByModality[state.activeModality]
  )
  if (!session || !isStudioSession(session)) return 0
  if (session.serverId) return session.serverId
  try {
    const created = await createProject({
      modality: session.modality,
      title: session.title,
      model: session.model || state.config.model,
      group: session.group || state.config.group,
      client_key: session.id,
      last_prompt: session.lastPrompt,
      preview_urls: session.previewUrls,
    })
    patchSessionById(session.id, {
      serverId: created.id,
      isDraft: false,
    })
    return created.id
  } catch {
    return 0
  }
}

/** Append a completed run preview onto the active studio session locally. */
export function recordActiveStudioRun(input: {
  prompt: string
  model: string
  previewUrls?: string[]
  run?: StudioRunSummary
}): void {
  const state = usePlaygroundStore.getState()
  const modality = state.activeModality
  if (modality === 'chat') return
  const sessionId = state.activeSessionByModality[modality]
  const session = state.sessions.find((item) => item.id === sessionId)
  if (!session || !isStudioSession(session)) return

  const nextPreviews = [
    ...(session.previewUrls ?? []),
    ...(input.previewUrls ?? []),
  ]
    .filter((url, index, all) => all.indexOf(url) === index)
    .filter((url) => !url.startsWith('data:') && !url.startsWith('blob:'))
    .slice(-12)
  const nextRuns = input.run
    ? [...(session.runs ?? []), input.run].slice(-40)
    : session.runs
  const title =
    session.isDraft ||
    session.title.startsWith('Untitled') ||
    session.title === 'New chat'
      ? input.prompt.trim().slice(0, 48) || session.title
      : session.title

  usePlaygroundStore.setState({
    sessions: state.sessions.map((item) =>
      item.id === session.id
        ? {
            ...session,
            title,
            model: input.model || session.model,
            lastPrompt: input.prompt,
            previewUrls: nextPreviews,
            runs: nextRuns,
            isDraft: false,
            updatedAt: Date.now(),
          }
        : item
    ),
  })
}
