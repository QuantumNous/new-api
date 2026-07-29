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
import { create } from 'zustand'
import {
  persist,
  type PersistStorage,
  type StorageValue,
} from 'zustand/middleware'

import {
  DEFAULT_CONFIG,
  DEFAULT_PARAMETER_ENABLED,
} from '@/features/playground/constants'
import type {
  ActiveSessionByModality,
  PlaygroundSession,
  SessionModality,
} from '@/features/playground/lib/session/session-types'
import {
  createEmptySession,
  findSession,
  getActiveSession,
  isChatSession,
  titleFromFirstUserMessage,
  touchSession,
  upsertSession,
} from '@/features/playground/lib/session/session-utils'
import {
  applyMessageStateUpdate,
  type MessageStateUpdater,
} from '@/features/playground/lib/state/playground-state-utils'
import {
  DEFAULT_STUDIO_SETTINGS,
  MAX_DUO_ANSWER_MODELS,
  PLAYGROUND_STORE_STORAGE_KEY,
  PLAYGROUND_STORE_VERSION,
  loadPersistedPlaygroundState,
  normalizeStudioSettings,
  preparePersistedPlaygroundState,
  type PersistedPlaygroundState,
  type PlaygroundWorkspaceMode,
} from '@/features/playground/lib/storage/store-migration'
import {
  DEFAULT_CHAT_TOOLS,
  MAX_PINNED_MODELS,
  normalizeChatTools,
  type WorkbenchChatTools,
} from '@/features/playground/lib/workbench/workbench-prefs'
import type {
  GroupOption,
  Message,
  ModelOption,
  ParameterEnabled,
  PlaygroundConfig,
  StudioModality,
  StudioSettings,
} from '@/features/playground/types'

const PERSIST_WRITE_DEBOUNCE_MS = 500

export type PlaygroundPrefill = {
  prompt: string
  nonce: number
}

export type PlaygroundGenerationStatus = {
  activeModality: StudioModality | null
  pendingCount: number
}

/** Transient mid-thread model switch tip (not a chat message). */
export type ModelSwitchNotice = {
  id: number
  from: string
  to: string
}

interface PlaygroundStoreState extends PersistedPlaygroundState {
  // Ephemeral (not persisted)
  models: ModelOption[]
  groups: GroupOption[]
  prefill: PlaygroundPrefill | null
  generation: PlaygroundGenerationStatus
  modelSwitchNotice: ModelSwitchNotice | null

  setWorkspaceMode: (mode: PlaygroundWorkspaceMode) => void
  setActiveModality: (modality: StudioModality) => void
  /**
   * Select an engine. Does not switch modality by itself — callers that
   * know the model's modality should call setActiveModality / selectModality.
   * When options.switchModality is set, also switch workspace modality and
   * restore/create that modality's session.
   */
  selectModel: (
    model: string,
    group?: string,
    options?: { switchModality?: StudioModality; startNewSession?: boolean }
  ) => void
  clearModelSwitchNotice: () => void
  selectDuo: () => void
  updateConfig: (patch: Partial<PlaygroundConfig>) => void
  resetConfig: () => void
  setParameterEnabled: (patch: Partial<ParameterEnabled>) => void
  setChatTools: (patch: Partial<WorkbenchChatTools>) => void
  setStudioSettings: (
    value: StudioSettings | ((prev: StudioSettings) => StudioSettings)
  ) => void
  setDuoConfig: (patch: {
    answerModels?: string[]
    summaryModel?: string
    lastPrompt?: string
    lastLegs?: Array<{ model: string; content?: string; error?: string }>
    lastSummary?: string
  }) => void
  togglePinnedModel: (modelName: string) => void
  /** Update messages on the active chat session. */
  setMessages: (updater: MessageStateUpdater) => void
  /** Start a fresh chat session (does not delete the previous one). */
  clearMessages: () => void
  startNewSession: (modality?: SessionModality) => void
  openSession: (sessionId: string) => void
  deleteSession: (sessionId: string) => void
  renameSession: (sessionId: string, title: string) => void
  togglePinSession: (sessionId: string) => void
  updateActiveSession: (
    patch:
      | Partial<PlaygroundSession>
      | ((prev: PlaygroundSession) => PlaygroundSession)
  ) => void
  setSessionDraft: (sessionId: string, draft: string) => void
  setModels: (models: ModelOption[]) => void
  setGroups: (groups: GroupOption[]) => void
  setPrefill: (prompt: string) => void
  consumePrefill: () => void
  setSettingsPanelOpen: (open: boolean) => void
  beginGeneration: (modality: StudioModality) => void
  endGeneration: () => void
  resetWorkbenchPrefs: () => void
}

function withActiveSessionUpdate(
  state: PlaygroundStoreState,
  updater: (session: PlaygroundSession) => PlaygroundSession
): Partial<PlaygroundStoreState> {
  const modality = state.activeModality
  const current = getActiveSession(
    state.sessions,
    state.activeSessionByModality,
    modality
  )
  if (!current) return {}
  const next = touchSession(updater(current))
  return {
    sessions: upsertSession(state.sessions, next),
    activeSessionByModality: {
      ...state.activeSessionByModality,
      [modality]: next.id,
    },
  }
}

function ensureModalitySession(
  state: {
    sessions: PlaygroundSession[]
    activeSessionByModality: ActiveSessionByModality
    config: PlaygroundConfig
  },
  modality: SessionModality
): {
  sessions: PlaygroundSession[]
  activeSessionByModality: ActiveSessionByModality
  session: PlaygroundSession
} {
  const existing = getActiveSession(
    state.sessions,
    state.activeSessionByModality,
    modality
  )
  if (existing) {
    return {
      sessions: state.sessions,
      activeSessionByModality: state.activeSessionByModality,
      session: existing,
    }
  }
  const draft = createEmptySession(
    modality,
    state.config.model,
    state.config.group
  )
  return {
    sessions: upsertSession(state.sessions, draft),
    activeSessionByModality: {
      ...state.activeSessionByModality,
      [modality]: draft.id,
    },
    session: draft,
  }
}

// Debounced, validated persistence: reads go through the migration reader
// (v2 key with fallback to the five legacy keys), writes are trailing
// debounced so streaming updates do not hammer localStorage. Pending writes
// are flushed on pagehide/beforeunload.
let pendingWrite: {
  name: string
  value: StorageValue<PersistedPlaygroundState>
} | null = null
let writeTimer: number | null = null

function flushPendingWrite(): void {
  if (writeTimer !== null) {
    window.clearTimeout(writeTimer)
    writeTimer = null
  }
  if (!pendingWrite) return
  const { name, value } = pendingWrite
  pendingWrite = null
  try {
    localStorage.setItem(name, JSON.stringify(value))
  } catch {
    // Storage may be unavailable or full (private browsing, quota).
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushPendingWrite)
  window.addEventListener('beforeunload', flushPendingWrite)
}

const playgroundPersistStorage: PersistStorage<PersistedPlaygroundState> = {
  getItem: () => ({
    state: loadPersistedPlaygroundState(),
    version: PLAYGROUND_STORE_VERSION,
  }),
  setItem: (name, value) => {
    pendingWrite = { name, value }
    if (writeTimer !== null) return
    writeTimer = window.setTimeout(() => {
      writeTimer = null
      flushPendingWrite()
    }, PERSIST_WRITE_DEBOUNCE_MS)
  },
  removeItem: (name) => {
    pendingWrite = null
    if (writeTimer !== null) {
      window.clearTimeout(writeTimer)
      writeTimer = null
    }
    try {
      localStorage.removeItem(name)
    } catch {
      // Storage may be unavailable.
    }
  },
}

export const usePlaygroundStore = create<PlaygroundStoreState>()(
  persist(
    (set, get) => ({
      // Persisted state; real values arrive synchronously via rehydration.
      workspaceMode: 'model',
      activeModality: 'chat',
      config: { ...DEFAULT_CONFIG },
      parameterEnabled: { ...DEFAULT_PARAMETER_ENABLED },
      chatTools: { ...DEFAULT_CHAT_TOOLS },
      studioSettings: { ...DEFAULT_STUDIO_SETTINGS },
      duo: { answerModels: [], summaryModel: '' },
      pinnedModels: [],
      messages: [],
      sessions: [],
      activeSessionByModality: {},
      ui: { settingsPanelOpen: true },

      models: [],
      groups: [],
      prefill: null,
      generation: { activeModality: null, pendingCount: 0 },
      modelSwitchNotice: null,

      setWorkspaceMode: (workspaceMode) => set({ workspaceMode }),
      setActiveModality: (modality) =>
        set((state) => {
          const ensured = ensureModalitySession(state, modality)
          const session = ensured.session
          return {
            activeModality: modality,
            workspaceMode: 'model',
            sessions: ensured.sessions,
            activeSessionByModality: ensured.activeSessionByModality,
            config: {
              ...state.config,
              model: session.model || state.config.model,
              group: session.group || state.config.group,
            },
          }
        }),
      selectModel: (model, group, options) =>
        set((state) => {
          const modality = options?.switchModality ?? state.activeModality
          const startNew = options?.startNewSession === true
          let sessions = state.sessions
          let activeSessionByModality = state.activeSessionByModality
          let activeSession = getActiveSession(
            sessions,
            activeSessionByModality,
            modality
          )
          let modelSwitchNotice: ModelSwitchNotice | null =
            state.modelSwitchNotice

          if (startNew || !activeSession) {
            const draft = createEmptySession(
              modality,
              model,
              group ?? state.config.group
            )
            sessions = upsertSession(sessions, draft)
            activeSessionByModality = {
              ...activeSessionByModality,
              [modality]: draft.id,
            }
            activeSession = draft
            modelSwitchNotice = null
          } else {
            const previousModel = activeSession.model
            // Strip legacy model-switch markers that used to live in the
            // transcript as fake system turns.
            const cleanedMessages = isChatSession(activeSession)
              ? activeSession.messages.filter(
                  (message) =>
                    !(message.modelChangeFrom && message.modelChangeTo)
                )
              : undefined
            const nextSession: PlaygroundSession = {
              ...activeSession,
              model,
              group: group ?? activeSession.group,
              ...(cleanedMessages ? { messages: cleanedMessages } : {}),
            }
            // Mid-thread switches surface as a short-lived status tip only.
            if (
              isChatSession(activeSession) &&
              previousModel &&
              previousModel !== model &&
              (cleanedMessages?.length ?? 0) > 0
            ) {
              modelSwitchNotice = {
                id: Date.now(),
                from: previousModel,
                to: model,
              }
            }
            sessions = upsertSession(sessions, touchSession(nextSession))
          }

          return {
            config: {
              ...state.config,
              model,
              ...(group !== undefined ? { group } : {}),
            },
            activeModality: modality,
            workspaceMode: 'model',
            sessions,
            activeSessionByModality,
            modelSwitchNotice,
          }
        }),
      clearModelSwitchNotice: () => set({ modelSwitchNotice: null }),
      selectDuo: () => set({ workspaceMode: 'duo' }),
      updateConfig: (patch) =>
        set((state) => {
          const nextConfig = { ...state.config, ...patch }
          const sessionPatch =
            patch.model !== undefined || patch.group !== undefined
              ? withActiveSessionUpdate(state, (session) => ({
                  ...session,
                  ...(patch.model !== undefined ? { model: patch.model } : {}),
                  ...(patch.group !== undefined ? { group: patch.group } : {}),
                }))
              : {}
          return { config: nextConfig, ...sessionPatch }
        }),
      resetConfig: () =>
        set({
          config: { ...DEFAULT_CONFIG },
          parameterEnabled: { ...DEFAULT_PARAMETER_ENABLED },
        }),
      setParameterEnabled: (patch) =>
        set((state) => ({
          parameterEnabled: { ...state.parameterEnabled, ...patch },
        })),
      setChatTools: (patch) =>
        set((state) => ({
          chatTools: normalizeChatTools({ ...state.chatTools, ...patch }),
        })),
      setStudioSettings: (value) =>
        set((state) => ({
          studioSettings: normalizeStudioSettings(
            typeof value === 'function' ? value(state.studioSettings) : value
          ),
        })),
      setDuoConfig: (patch) =>
        set((state) => ({
          duo: {
            answerModels: (patch.answerModels ?? state.duo.answerModels).slice(
              0,
              MAX_DUO_ANSWER_MODELS
            ),
            summaryModel: patch.summaryModel ?? state.duo.summaryModel,
            lastPrompt:
              patch.lastPrompt !== undefined
                ? patch.lastPrompt
                : state.duo.lastPrompt,
            lastLegs:
              patch.lastLegs !== undefined
                ? patch.lastLegs.slice(0, MAX_DUO_ANSWER_MODELS)
                : state.duo.lastLegs,
            lastSummary:
              patch.lastSummary !== undefined
                ? patch.lastSummary
                : state.duo.lastSummary,
          },
        })),
      togglePinnedModel: (modelName) =>
        set((state) => {
          const exists = state.pinnedModels.includes(modelName)
          return {
            pinnedModels: exists
              ? state.pinnedModels.filter((name) => name !== modelName)
              : [modelName, ...state.pinnedModels].slice(0, MAX_PINNED_MODELS),
          }
        }),
      setMessages: (updater) =>
        set((state) => {
          const current = getActiveSession(
            state.sessions,
            state.activeSessionByModality,
            'chat'
          )
          // Ensure a chat session exists even if modality is temporarily media.
          let sessions = state.sessions
          let activeSessionByModality = state.activeSessionByModality
          let chatSession = current
          if (!chatSession || !isChatSession(chatSession)) {
            const ensured = ensureModalitySession(
              { ...state, sessions, activeSessionByModality },
              'chat'
            )
            sessions = ensured.sessions
            activeSessionByModality = ensured.activeSessionByModality
            chatSession = ensured.session
          }
          if (!isChatSession(chatSession)) return {}

          const nextMessages = applyMessageStateUpdate(
            chatSession.messages,
            updater
          )
          const autoTitle =
            chatSession.title === 'New chat' ||
            chatSession.title === 'Imported Playground chat'
              ? titleFromFirstUserMessage(nextMessages)
              : null
          const nextSession = touchSession({
            ...chatSession,
            messages: nextMessages,
            isDraft: nextMessages.length === 0,
            title: autoTitle || chatSession.title,
            model: state.config.model || chatSession.model,
            group: state.config.group || chatSession.group,
          })
          return {
            sessions: upsertSession(sessions, nextSession),
            activeSessionByModality: {
              ...activeSessionByModality,
              chat: nextSession.id,
            },
            // Keep legacy field empty; selectors read from sessions.
            messages: [],
          }
        }),
      clearMessages: () => get().startNewSession('chat'),
      startNewSession: (modality) =>
        set((state) => {
          const target = modality ?? state.activeModality
          const draft = createEmptySession(
            target,
            state.config.model,
            state.config.group
          )
          return {
            activeModality: target,
            workspaceMode: 'model',
            sessions: upsertSession(state.sessions, draft),
            activeSessionByModality: {
              ...state.activeSessionByModality,
              [target]: draft.id,
            },
          }
        }),
      openSession: (sessionId) =>
        set((state) => {
          const session = findSession(state.sessions, sessionId)
          if (!session) return {}
          return {
            activeModality: session.modality,
            workspaceMode: 'model',
            activeSessionByModality: {
              ...state.activeSessionByModality,
              [session.modality]: session.id,
            },
            config: {
              ...state.config,
              model: session.model || state.config.model,
              group: session.group || state.config.group,
            },
          }
        }),
      deleteSession: (sessionId) =>
        set((state) => {
          const target = findSession(state.sessions, sessionId)
          if (!target) return {}
          const remaining = state.sessions.filter(
            (session) => session.id !== sessionId
          )
          const activeId = state.activeSessionByModality[target.modality]
          let activeSessionByModality = state.activeSessionByModality
          let sessions = remaining
          if (activeId === sessionId) {
            const nextSame = remaining.find(
              (session) => session.modality === target.modality
            )
            if (nextSame) {
              activeSessionByModality = {
                ...activeSessionByModality,
                [target.modality]: nextSame.id,
              }
            } else {
              const draft = createEmptySession(
                target.modality,
                state.config.model,
                state.config.group
              )
              sessions = upsertSession(remaining, draft)
              activeSessionByModality = {
                ...activeSessionByModality,
                [target.modality]: draft.id,
              }
            }
          }
          return { sessions, activeSessionByModality }
        }),
      renameSession: (sessionId, title) =>
        set((state) => {
          const session = findSession(state.sessions, sessionId)
          if (!session) return {}
          const trimmed = title.trim()
          if (!trimmed) return {}
          return {
            sessions: upsertSession(
              state.sessions,
              touchSession({ ...session, title: trimmed, isDraft: false })
            ),
          }
        }),
      togglePinSession: (sessionId) =>
        set((state) => {
          const session = findSession(state.sessions, sessionId)
          if (!session) return {}
          return {
            sessions: upsertSession(
              state.sessions,
              touchSession({ ...session, pinned: !session.pinned })
            ),
          }
        }),
      updateActiveSession: (patch) =>
        set((state) =>
          withActiveSessionUpdate(state, (session) => {
            if (typeof patch === 'function') return patch(session)
            return { ...session, ...patch } as PlaygroundSession
          })
        ),
      setSessionDraft: (sessionId, draft) =>
        set((state) => {
          const session = findSession(state.sessions, sessionId)
          if (!session) return {}
          return {
            sessions: upsertSession(
              state.sessions,
              touchSession({ ...session, draft })
            ),
          }
        }),
      setModels: (models) => set({ models }),
      setGroups: (groups) => set({ groups }),
      setPrefill: (prompt) =>
        set((state) => ({
          prefill: { prompt, nonce: (state.prefill?.nonce ?? 0) + 1 },
        })),
      consumePrefill: () => set({ prefill: null }),
      setSettingsPanelOpen: (open) => set({ ui: { settingsPanelOpen: open } }),
      beginGeneration: (modality) =>
        set((state) => ({
          generation: {
            activeModality: modality,
            pendingCount: state.generation.pendingCount + 1,
          },
        })),
      endGeneration: () =>
        set((state) => {
          const pendingCount = Math.max(0, state.generation.pendingCount - 1)
          return {
            generation: {
              activeModality:
                pendingCount === 0 ? null : state.generation.activeModality,
              pendingCount,
            },
          }
        }),
      resetWorkbenchPrefs: () =>
        set({
          pinnedModels: [],
          chatTools: { ...DEFAULT_CHAT_TOOLS },
          duo: { answerModels: [], summaryModel: '' },
        }),
    }),
    {
      name: PLAYGROUND_STORE_STORAGE_KEY,
      version: PLAYGROUND_STORE_VERSION,
      storage: playgroundPersistStorage,
      partialize: (state): PersistedPlaygroundState =>
        preparePersistedPlaygroundState(state),
    }
  )
)

/** Active chat messages for the current chat session (empty if none). */
export function selectActiveChatMessages(
  state: PlaygroundStoreState
): Message[] {
  const session = getActiveSession(
    state.sessions,
    state.activeSessionByModality,
    'chat'
  )
  if (!isChatSession(session)) return []
  // Legacy sessions may still hold model-switch markers; never render them.
  return session.messages.filter(
    (message) => !(message.modelChangeFrom && message.modelChangeTo)
  )
}

export function selectActiveSession(
  state: PlaygroundStoreState
): PlaygroundSession | null {
  return getActiveSession(
    state.sessions,
    state.activeSessionByModality,
    state.activeModality
  )
}
