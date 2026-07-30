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
  appendConversationMessages,
  createConversation,
  createProject,
  deleteConversation,
  deleteProject,
  getProject,
  listConversationMessages,
  listConversations,
  listConversationsSince,
  listProjects,
  putConversationMessages,
  updateConversation,
  updateProject,
  type PlaygroundRun,
  type ServerConversation,
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
  isLegacyModelSwitchMarker,
  isStudioSession,
  type ChatSession,
  type PlaygroundSession,
  type StudioRunSummary,
  type StudioSession,
} from '../lib'
import type { Message } from '../types'

const SYNC_DEBOUNCE_MS = 300
const CONVERSATION_POLL_MS = 60_000
const APPEND_BATCH_SIZE = 40

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
      if (message.reasoning) tool.reasoning = message.reasoning
      const hasTool = Object.keys(tool).length > 0
      return {
        role: message.from,
        content: getMessageContent(message),
        model: message.model || undefined,
        client_key: message.key,
        source: 'web',
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
  return items
    .map((item, index) => {
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
        versions: [
          { id: `v-${item.id || index}`, content: item.content || '' },
        ],
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
    .filter((message) => !isLegacyModelSwitchMarker(message))
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

function chatSessionFromServerConversation(
  item: ServerConversation,
  messages: Message[]
): ChatSession {
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
            typeof meta.summaryModel === 'string' ? meta.summaryModel : '',
        }
      }
    } catch {
      duoMeta = undefined
    }
  }
  const session = createChatSession({
    id: `cloud_${item.id}`,
    serverId: item.id,
    title: item.title || 'Cloud chat',
    model: item.model || '',
    group: item.group || '',
    messages,
    kind: item.kind === 'duo' ? 'duo' : 'chat',
    duoMeta,
    isDraft: false,
    createdAt: (item.created_at || 0) * 1000 || Date.now(),
    updatedAt: (item.updated_at || 0) * 1000 || Date.now(),
  })
  session.pinned = Boolean(item.pinned)
  return session
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

type ChatSyncState = {
  reconciled: boolean
  maxServerMsgId: number
  /** client_key -> content fingerprint of turns known to exist server-side. */
  acked: Map<string, string>
  lastMetaFingerprint: string
  lastLocalFingerprint: string
  inflight: boolean
  rerun: boolean
}

function freshChatSyncState(): ChatSyncState {
  return {
    reconciled: false,
    maxServerMsgId: 0,
    acked: new Map(),
    lastMetaFingerprint: '',
    lastLocalFingerprint: '',
    inflight: false,
    rerun: false,
  }
}

function finalizedChatMessages(messages: Message[]): Message[] {
  return messages.filter(
    (message) =>
      (message.from === 'user' || message.from === 'assistant') &&
      message.status !== 'loading' &&
      message.status !== 'streaming'
  )
}

function chatMetaFingerprint(session: ChatSession): string {
  return JSON.stringify([
    session.title,
    session.model,
    session.group,
    session.kind === 'duo' ? 'duo' : 'chat',
    session.duoMeta ?? null,
    session.pinned ?? false,
  ])
}

function chatLocalFingerprint(session: ChatSession): string {
  const finalized = finalizedChatMessages(session.messages)
  let contentBytes = 0
  for (const message of finalized) {
    contentBytes += getMessageContent(message).length
  }
  return `${finalized.length}:${finalized.at(-1)?.key ?? ''}:${contentBytes}:${chatMetaFingerprint(session)}`
}

/** Append cross-device turns pulled from the server onto the local cache. */
function mergeRemoteMessagesIntoSession(
  sessionId: string,
  remote: Message[]
): void {
  if (remote.length === 0) return
  const state = usePlaygroundStore.getState()
  usePlaygroundStore.setState({
    sessions: state.sessions.map((item) => {
      if (item.id !== sessionId || !isChatSession(item)) return item
      const known = new Set(item.messages.map((message) => message.key))
      const additions = remote.filter((message) => !known.has(message.key))
      if (additions.length === 0) return item
      return {
        ...item,
        messages: [...item.messages, ...additions],
        isDraft: false,
        updatedAt: Date.now(),
      }
    }),
  })
}

/**
 * Cloud sync for chat + studio sessions. Chat threads are server-first for
 * logged-in users:
 * - user/assistant turns are appended per turn (client_key idempotent) as soon
 *   as they finalize; local edits/regenerates fall back to a snapshot replace
 * - opening a thread and window focus pull turns written by other devices
 * - the thread list is polled with an updated_at cursor to pick up new threads
 * - Studio projects keep the debounced metadata push
 * - Best-effort delete of cloud records when a local session is removed
 */
export function useSessionCloudSync(isAuthenticated: boolean) {
  const sessions = usePlaygroundStore((state) => state.sessions)
  const activeChatId = usePlaygroundStore(
    (state) => state.activeSessionByModality.chat
  )
  const timerRef = useRef<number | null>(null)
  const inflightRef = useRef(false)
  const importedRef = useRef(false)
  const knownIdsRef = useRef<Set<string>>(new Set())
  const serverBindingsRef = useRef<
    Map<string, { kind: 'chat' | 'project'; serverId: number }>
  >(new Map())
  const chatStatesRef = useRef<Map<string, ChatSyncState>>(new Map())
  const convCursorRef = useRef<number>(0)

  const reconcileChatSession = useCallback(
    async (sessionId: string, options?: { pull?: boolean }) => {
      if (!isAuthenticated) return
      const findSession = () => {
        const found = usePlaygroundStore
          .getState()
          .sessions.find((item) => item.id === sessionId)
        return found && isChatSession(found) ? found : undefined
      }
      let session = findSession()
      if (!session) return

      let st = chatStatesRef.current.get(sessionId)
      if (!st) {
        st = freshChatSyncState()
        chatStatesRef.current.set(sessionId, st)
      }
      if (st.inflight) {
        st.rerun = true
        return
      }
      st.inflight = true
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
          if (finalizedChatMessages(session.messages).length === 0) return
          const created = await createConversation({
            title: session.title,
            model: session.model,
            group: session.group,
            kind,
            meta_json: meta,
            source: 'web',
          })
          serverId = created.id
          patchSessionById(session.id, { serverId, isDraft: false })
          serverBindingsRef.current.set(session.id, { kind: 'chat', serverId })
          st.reconciled = true
          st.lastMetaFingerprint = chatMetaFingerprint(session)
        }

        // Pull turns this client has not seen yet (bootstrap or cross-device).
        if (!st.reconciled || options?.pull) {
          if (!st.reconciled) {
            st.maxServerMsgId = 0
            st.acked = new Map()
          }
          const fetched: ServerMessage[] = []
          for (;;) {
            const page = await listConversationMessages(serverId, {
              since_id: st.maxServerMsgId,
              limit: 200,
            })
            fetched.push(...page.messages)
            const tail = page.messages.at(-1)
            if (tail) {
              st.maxServerMsgId = tail.id
            }
            if (!page.has_more) break
          }
          const localKeys = new Set(session.messages.map((m) => m.key))
          const remoteOnly: ServerMessage[] = []
          for (const item of fetched) {
            const key = item.client_key || `srv-${item.id}`
            st.acked.set(key, item.content || '')
            if (!localKeys.has(key)) remoteOnly.push(item)
          }
          st.reconciled = true
          if (remoteOnly.length > 0) {
            mergeRemoteMessagesIntoSession(
              sessionId,
              fromServerMessages(remoteOnly)
            )
            session = findSession()
            if (!session) return
          }
        }

        // Local rewrite (edit / regenerate / delete) invalidates append-only
        // sync; fall back to a full snapshot replace.
        const finalized = finalizedChatMessages(session.messages)
        const localByKey = new Map(
          finalized.map((message) => [message.key, message])
        )
        let rewritten = false
        for (const [key, ackedContent] of st.acked) {
          const local = localByKey.get(key)
          if (!local || getMessageContent(local) !== ackedContent) {
            rewritten = true
            break
          }
        }

        if (rewritten) {
          await putConversationMessages(serverId, toServerMessages(finalized))
          st.acked = new Map(
            finalized.map((message) => [
              message.key,
              getMessageContent(message),
            ])
          )
          // Server ids were recreated by the replace; refetch on next pull.
          st.reconciled = false
          st.maxServerMsgId = 0
        } else {
          const pending = finalized.filter(
            (message) => !st.acked.has(message.key)
          )
          for (let i = 0; i < pending.length; i += APPEND_BATCH_SIZE) {
            const batch = pending.slice(i, i + APPEND_BATCH_SIZE)
            const result = await appendConversationMessages(
              serverId,
              toServerMessages(batch)
            )
            for (const message of batch) {
              st.acked.set(message.key, getMessageContent(message))
            }
            for (const inserted of result.messages) {
              if (inserted.id > st.maxServerMsgId) {
                st.maxServerMsgId = inserted.id
              }
            }
          }
        }

        const metaFingerprint = chatMetaFingerprint(session)
        if (metaFingerprint !== st.lastMetaFingerprint) {
          await updateConversation(serverId, {
            title: session.title,
            model: session.model,
            group: session.group,
            kind,
            meta_json: meta,
            pinned: session.pinned ?? false,
          })
          st.lastMetaFingerprint = metaFingerprint
        }
        st.lastLocalFingerprint = chatLocalFingerprint(session)
      } catch {
        // Offline / API errors are non-fatal; retry on the next store change.
      } finally {
        st.inflight = false
        if (st.rerun) {
          st.rerun = false
          void reconcileChatSession(sessionId, options)
        }
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

  // Debounced push: chat turns append as soon as they finalize in the store;
  // studio projects keep the metadata upsert.
  useEffect(() => {
    if (!isAuthenticated) return
    if (timerRef.current != null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      const state = usePlaygroundStore.getState()
      for (const session of state.sessions) {
        if (isChatSession(session)) {
          if (session.messages.length === 0 && !session.serverId) continue
          const st = chatStatesRef.current.get(session.id)
          if (st && st.lastLocalFingerprint === chatLocalFingerprint(session)) {
            continue
          }
          void reconcileChatSession(session.id)
        } else if (isStudioSession(session) && hasSessionContent(session)) {
          void syncStudioSession(session)
        }
      }
    }, SYNC_DEBOUNCE_MS)

    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
    }
  }, [isAuthenticated, sessions, reconcileChatSession, syncStudioSession])

  // Opening a thread pulls turns other devices appended since we last looked.
  useEffect(() => {
    if (!isAuthenticated || !activeChatId) return
    void reconcileChatSession(activeChatId, { pull: true })
  }, [isAuthenticated, activeChatId, reconcileChatSession])

  // Thread-list cursor poll (focus + interval): metadata changes, new threads.
  useEffect(() => {
    if (!isAuthenticated) return

    const pullConversationList = async () => {
      if (convCursorRef.current === 0) return // wait for the initial import
      try {
        const { items } = await listConversationsSince(convCursorRef.current)
        if (items.length === 0) return
        for (const item of items) {
          convCursorRef.current = Math.max(
            convCursorRef.current,
            item.updated_at
          )
        }
        const state = usePlaygroundStore.getState()
        const additions: PlaygroundSession[] = []
        for (const item of items) {
          const local = state.sessions.find(
            (s) => isChatSession(s) && s.serverId === item.id
          )
          if (local) {
            const remoteUpdatedAt = (item.updated_at || 0) * 1000
            if (remoteUpdatedAt > local.updatedAt) {
              patchSessionById(local.id, {
                title: item.title || local.title,
                pinned: Boolean(item.pinned),
              })
              if (
                local.id ===
                usePlaygroundStore.getState().activeSessionByModality.chat
              ) {
                void reconcileChatSession(local.id, { pull: true })
              }
            }
            continue
          }
          if (state.sessions.some((s) => s.id === `cloud_${item.id}`)) continue
          additions.push(chatSessionFromServerConversation(item, []))
        }
        if (additions.length > 0) {
          const latest = usePlaygroundStore.getState()
          usePlaygroundStore.setState({
            sessions: [...additions, ...latest.sessions],
          })
        }
      } catch {
        // Poll failures are non-fatal.
      }
    }

    const onFocus = () => void pullConversationList()
    window.addEventListener('focus', onFocus)
    const interval = window.setInterval(
      () => void pullConversationList(),
      CONVERSATION_POLL_MS
    )
    return () => {
      window.removeEventListener('focus', onFocus)
      window.clearInterval(interval)
    }
  }, [isAuthenticated, reconcileChatSession])

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
          // Messages hydrate lazily when the thread is opened (activation pull).
          additions.push(chatSessionFromServerConversation(item, []))
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
        convCursorRef.current = Math.floor(Date.now() / 1000)
      } catch {
        // Ignore list failures; user can still work offline.
      } finally {
        inflightRef.current = false
      }
    })()
  }, [isAuthenticated])
}

/**
 * Ensure a studio session is cloud-bound; returns project id or 0. Defaults
 * to the active session; pass the id captured at submit time so late results
 * bind to the session that requested them.
 */
export async function ensureActiveStudioProjectId(
  sessionId?: string
): Promise<number> {
  const state = usePlaygroundStore.getState()
  const targetId =
    sessionId ?? state.activeSessionByModality[state.activeModality]
  const session = state.sessions.find((item) => item.id === targetId)
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

/**
 * Append a completed run preview onto a studio session locally. Defaults to
 * the active session; pass `sessionId` captured at submit time so results
 * arriving after a session switch land in the right project.
 */
export function recordActiveStudioRun(input: {
  prompt: string
  model: string
  previewUrls?: string[]
  run?: StudioRunSummary
  sessionId?: string
}): void {
  const state = usePlaygroundStore.getState()
  let sessionId = input.sessionId
  if (!sessionId) {
    const modality = state.activeModality
    if (modality === 'chat') return
    sessionId = state.activeSessionByModality[modality] ?? undefined
  }
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
