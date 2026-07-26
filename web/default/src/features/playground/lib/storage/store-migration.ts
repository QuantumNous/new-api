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
import { STORAGE_KEYS } from '../../constants'
import type {
  Message,
  ParameterEnabled,
  PlaygroundConfig,
  StudioModality,
  StudioSettings,
} from '../../types'
import type {
  ActiveSessionByModality,
  PlaygroundSession,
  SessionModality,
} from '../session/session-types'
import {
  createEmptySession,
  importLegacyMessagesSession,
  isChatSession,
  pruneSessions,
  upsertSession,
} from '../session/session-utils'
import {
  getInitialParameterEnabled,
  getInitialPlaygroundConfig,
} from '../state/playground-state-utils'
import { normalizeImageGenerationSettings } from '../studio/image-request-schema'
import {
  MAX_PINNED_MODELS,
  loadWorkbenchPrefs,
  normalizeChatTools,
  type WorkbenchChatTools,
} from '../workbench/workbench-prefs'
import { loadMessages, prepareLoadedMessages } from './storage'
import {
  MAX_STORED_MESSAGES,
  messagesSchema,
  playgroundConfigSchema,
} from './storage-schema'

export const PLAYGROUND_STORE_STORAGE_KEY = STORAGE_KEYS.STORE
export const PLAYGROUND_STORE_VERSION = 3

export type PlaygroundWorkspaceMode = 'model' | 'duo'

export type PlaygroundDuoLeg = {
  model: string
  content?: string
  error?: string
}

export type PlaygroundDuoConfig = {
  answerModels: string[]
  summaryModel: string
  /** Last duo prompt (lane persistence across reloads). */
  lastPrompt?: string
  /** Last multi-model leg results. */
  lastLegs?: PlaygroundDuoLeg[]
  /** Last summarizer output. */
  lastSummary?: string
}

export type PlaygroundUiPrefs = {
  settingsPanelOpen: boolean
}

/**
 * Client-side playground state persisted under the single versioned
 * `playground_store_v2` key (version field bumps independently). Server
 * data (models, pricing, tasks) lives in react-query, not here.
 */
export type PersistedPlaygroundState = {
  workspaceMode: PlaygroundWorkspaceMode
  /** Explicit workspace modality — not derived solely from the model. */
  activeModality: StudioModality
  config: PlaygroundConfig
  parameterEnabled: ParameterEnabled
  chatTools: WorkbenchChatTools
  studioSettings: StudioSettings
  duo: PlaygroundDuoConfig
  pinnedModels: string[]
  /**
   * @deprecated Kept only so v2 → v3 migration can import once. Runtime
   * reads go through `sessions` + `activeSessionByModality`.
   */
  messages: Message[]
  sessions: PlaygroundSession[]
  activeSessionByModality: ActiveSessionByModality
  ui: PlaygroundUiPrefs
}

function stripMessageForPersist(message: Message): Message {
  return {
    ...message,
    attachments: undefined,
    managedTool: message.managedTool
      ? {
          ...message.managedTool,
          images: message.managedTool.images?.filter(
            (url) => !url.startsWith('data:')
          ),
          videoUrl: message.managedTool.videoUrl?.startsWith('data:')
            ? undefined
            : message.managedTool.videoUrl,
        }
      : undefined,
  }
}

/** Remove ephemeral attachment data before Zustand serializes playground state. */
export function preparePersistedPlaygroundState(
  state: PersistedPlaygroundState
): PersistedPlaygroundState {
  const sessions = pruneSessions(state.sessions).map((session) => {
    if (isChatSession(session)) {
      const messages =
        session.messages.length > MAX_STORED_MESSAGES
          ? session.messages.slice(-MAX_STORED_MESSAGES)
          : session.messages
      return {
        ...session,
        messages: messages.map(stripMessageForPersist),
        draft: session.draft?.slice(0, 20_000),
      }
    }
    return {
      ...session,
      previewUrls: session.previewUrls
        ?.filter((url) => !url.startsWith('data:') && !url.startsWith('blob:'))
        .slice(0, 12),
      runs: session.runs?.slice(-40).map((run) => ({
        ...run,
        resultUrl:
          run.resultUrl?.startsWith('data:') ||
          run.resultUrl?.startsWith('blob:')
            ? undefined
            : run.resultUrl,
      })),
      draft: session.draft?.slice(0, 20_000),
    }
  })

  return {
    workspaceMode: state.workspaceMode,
    activeModality: state.activeModality,
    config: state.config,
    parameterEnabled: state.parameterEnabled,
    chatTools: state.chatTools,
    studioSettings: state.studioSettings,
    duo: {
      answerModels: state.duo.answerModels.slice(0, MAX_DUO_ANSWER_MODELS),
      summaryModel: state.duo.summaryModel,
      lastPrompt: state.duo.lastPrompt?.slice(0, 20_000),
      lastLegs: state.duo.lastLegs
        ?.slice(0, MAX_DUO_ANSWER_MODELS)
        .map((leg) => ({
          model: leg.model,
          content: leg.content?.slice(0, 40_000),
          error: leg.error?.slice(0, 2_000),
        })),
      lastSummary: state.duo.lastSummary?.slice(0, 100_000),
    },
    pinnedModels: state.pinnedModels,
    // Legacy field kept empty after v3 — sessions own the history.
    messages: [],
    sessions,
    activeSessionByModality: state.activeSessionByModality,
    ui: state.ui,
  }
}

export const DEFAULT_STUDIO_SETTINGS: StudioSettings = {
  imageCount: 1,
  imageSize: '1024x1024',
  imageQuality: 'auto',
  videoDuration: 5,
  videoSize: '1280x720',
  voice: 'alloy',
  speed: 1,
  audioFormat: 'mp3',
}

export const MAX_DUO_ANSWER_MODELS = 5

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .slice(0, limit)
}

export function normalizeStudioSettings(value: unknown): StudioSettings {
  const raw = isRecord(value) ? value : {}
  const merged = { ...DEFAULT_STUDIO_SETTINGS, ...raw }
  // Image fields are clamped to the GPT Image 2 schema.
  const image = normalizeImageGenerationSettings({
    imageCount: merged.imageCount,
    imageSize: merged.imageSize,
    imageQuality: merged.imageQuality,
  })
  return {
    imageCount: image.imageCount,
    imageSize: image.imageSize,
    imageQuality: image.imageQuality,
    videoDuration: clampNumber(
      merged.videoDuration,
      1,
      60,
      DEFAULT_STUDIO_SETTINGS.videoDuration
    ),
    videoSize:
      typeof merged.videoSize === 'string'
        ? merged.videoSize
        : DEFAULT_STUDIO_SETTINGS.videoSize,
    voice:
      typeof merged.voice === 'string'
        ? merged.voice
        : DEFAULT_STUDIO_SETTINGS.voice,
    speed: clampNumber(merged.speed, 0.25, 4, DEFAULT_STUDIO_SETTINGS.speed),
    audioFormat:
      typeof merged.audioFormat === 'string'
        ? merged.audioFormat
        : DEFAULT_STUDIO_SETTINGS.audioFormat,
  }
}

export function normalizeDuoConfig(value: unknown): PlaygroundDuoConfig {
  const raw = isRecord(value) ? value : {}
  const lastLegs = Array.isArray(raw.lastLegs)
    ? raw.lastLegs
        .filter((item): item is Record<string, unknown> => isRecord(item))
        .map((item) => ({
          model: typeof item.model === 'string' ? item.model : '',
          content: typeof item.content === 'string' ? item.content : undefined,
          error: typeof item.error === 'string' ? item.error : undefined,
        }))
        .filter((item) => item.model)
        .slice(0, MAX_DUO_ANSWER_MODELS)
    : undefined
  return {
    answerModels: stringArray(raw.answerModels, MAX_DUO_ANSWER_MODELS),
    summaryModel: typeof raw.summaryModel === 'string' ? raw.summaryModel : '',
    lastPrompt:
      typeof raw.lastPrompt === 'string'
        ? raw.lastPrompt.slice(0, 20_000)
        : undefined,
    lastLegs: lastLegs?.length ? lastLegs : undefined,
    lastSummary:
      typeof raw.lastSummary === 'string'
        ? raw.lastSummary.slice(0, 100_000)
        : undefined,
  }
}

function readLegacyStudioSettings(): StudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STUDIO)
    if (!raw) return { ...DEFAULT_STUDIO_SETTINGS }
    const parsed = JSON.parse(raw) as { settings?: unknown }
    return normalizeStudioSettings(parsed.settings)
  } catch {
    return { ...DEFAULT_STUDIO_SETTINGS }
  }
}

function readLegacyMessages(): Message[] {
  try {
    return loadMessages() ?? []
  } catch {
    return []
  }
}

/**
 * Assemble store state from the five legacy localStorage keys
 * (playground_config / playground_messages / playground_parameter_enabled /
 * playground_studio / playground_workbench_prefs_v1). Each key is read
 * independently so one corrupted key never discards the others. The legacy
 * keys are never deleted by this module — playground_messages in particular
 * stays on disk as the safety net for this release.
 */
function hasImportedLegacyMessages(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.LEGACY_MESSAGES_IMPORTED) === '1'
  } catch {
    return false
  }
}

function markLegacyMessagesImported(): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LEGACY_MESSAGES_IMPORTED, '1')
  } catch {
    // Storage may be unavailable.
  }
}

function buildSessionsFromLegacyMessages(
  messages: Message[],
  config: PlaygroundConfig
): {
  sessions: PlaygroundSession[]
  activeSessionByModality: ActiveSessionByModality
  activeModality: StudioModality
} {
  const activeModality: StudioModality = 'chat'
  let sessions: PlaygroundSession[] = []
  const activeSessionByModality: ActiveSessionByModality = {}

  if (messages.length > 0 && !hasImportedLegacyMessages()) {
    const imported = importLegacyMessagesSession({
      messages,
      model: config.model,
      group: config.group,
    })
    if (imported) {
      sessions = [imported]
      activeSessionByModality.chat = imported.id
      markLegacyMessagesImported()
    }
  }

  if (sessions.length === 0) {
    const draft = createEmptySession('chat', config.model, config.group)
    sessions = [draft]
    activeSessionByModality.chat = draft.id
  }

  return { sessions, activeSessionByModality, activeModality }
}

function normalizeModality(value: unknown): StudioModality {
  if (
    value === 'chat' ||
    value === 'image' ||
    value === 'video' ||
    value === 'audio'
  ) {
    return value
  }
  return 'chat'
}

function normalizeSessionRecord(
  value: unknown,
  fallbackModel: string,
  fallbackGroup: string
): PlaygroundSession | null {
  if (!isRecord(value)) return null
  const modality = normalizeModality(value.modality)
  const id = typeof value.id === 'string' ? value.id : ''
  if (!id) return null
  let title = 'Untitled project'
  if (typeof value.title === 'string' && value.title.trim()) {
    title = value.title.trim()
  } else if (modality === 'chat') {
    title = 'New chat'
  }
  const model = typeof value.model === 'string' ? value.model : fallbackModel
  const group = typeof value.group === 'string' ? value.group : fallbackGroup
  const createdAt =
    typeof value.createdAt === 'number' && Number.isFinite(value.createdAt)
      ? value.createdAt
      : Date.now()
  const updatedAt =
    typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt)
      ? value.updatedAt
      : createdAt
  const draft = typeof value.draft === 'string' ? value.draft : undefined
  const isDraft = value.isDraft === true
  const serverId =
    typeof value.serverId === 'number' && Number.isFinite(value.serverId)
      ? value.serverId
      : undefined

  if (modality === 'chat') {
    const messages = normalizeMessagesField(value.messages)
    const kind = value.kind === 'duo' ? 'duo' : 'chat'
    let duoMeta: { answerModels: string[]; summaryModel: string } | undefined
    if (isRecord(value.duoMeta)) {
      duoMeta = {
        answerModels: stringArray(value.duoMeta.answerModels, 5),
        summaryModel:
          typeof value.duoMeta.summaryModel === 'string'
            ? value.duoMeta.summaryModel
            : '',
      }
    }
    return {
      id,
      serverId,
      modality: 'chat',
      title,
      model,
      group,
      messages,
      kind,
      duoMeta,
      draft,
      isDraft: isDraft || messages.length === 0,
      createdAt,
      updatedAt,
    }
  }

  const previewUrls = Array.isArray(value.previewUrls)
    ? value.previewUrls
        .filter(
          (url): url is string =>
            typeof url === 'string' &&
            !url.startsWith('data:') &&
            !url.startsWith('blob:')
        )
        .slice(0, 12)
    : undefined
  const lastPrompt =
    typeof value.lastPrompt === 'string' ? value.lastPrompt : undefined
  const runs = Array.isArray(value.runs)
    ? value.runs
        .filter((item): item is Record<string, unknown> => isRecord(item))
        .map((item) => ({
          id: typeof item.id === 'number' ? item.id : 0,
          model: typeof item.model === 'string' ? item.model : undefined,
          prompt: typeof item.prompt === 'string' ? item.prompt : undefined,
          resultUrl:
            typeof item.resultUrl === 'string' ? item.resultUrl : undefined,
          assetId: typeof item.assetId === 'number' ? item.assetId : undefined,
          taskId: typeof item.taskId === 'string' ? item.taskId : undefined,
          createdAt:
            typeof item.createdAt === 'number' ? item.createdAt : undefined,
        }))
        .filter((item) => item.id > 0)
        .slice(0, 40)
    : undefined

  return {
    id,
    serverId,
    modality,
    title,
    model,
    group,
    previewUrls,
    lastPrompt,
    runs,
    draft,
    isDraft:
      isDraft ||
      (!lastPrompt &&
        (!previewUrls || previewUrls.length === 0) &&
        (!runs || runs.length === 0)),
    createdAt,
    updatedAt,
  }
}

function normalizeSessionsField(
  value: unknown,
  fallbackModel: string,
  fallbackGroup: string
): PlaygroundSession[] {
  if (!Array.isArray(value)) return []
  const sessions: PlaygroundSession[] = []
  for (const item of value) {
    const session = normalizeSessionRecord(item, fallbackModel, fallbackGroup)
    if (session) sessions.push(session)
  }
  return pruneSessions(sessions)
}

function normalizeActiveSessionMap(value: unknown): ActiveSessionByModality {
  if (!isRecord(value)) return {}
  const result: ActiveSessionByModality = {}
  for (const modality of [
    'chat',
    'image',
    'video',
    'audio',
  ] as SessionModality[]) {
    const id = value[modality]
    if (typeof id === 'string' || id === null) {
      result[modality] = id
    }
  }
  return result
}

export function readLegacyPlaygroundState(): PersistedPlaygroundState {
  const prefs = loadWorkbenchPrefs()
  const config = getInitialPlaygroundConfig()
  const messages = readLegacyMessages()
  const { sessions, activeSessionByModality, activeModality } =
    buildSessionsFromLegacyMessages(messages, config)
  return {
    workspaceMode: 'model',
    activeModality,
    config,
    parameterEnabled: getInitialParameterEnabled(),
    chatTools: prefs.chatTools,
    studioSettings: readLegacyStudioSettings(),
    duo: normalizeDuoConfig(prefs.duo),
    pinnedModels: prefs.pinnedModels,
    messages: [],
    sessions,
    activeSessionByModality,
    ui: { settingsPanelOpen: true },
  }
}

function normalizeConfigField(value: unknown): PlaygroundConfig {
  try {
    const parsed = playgroundConfigSchema.parse(value)
    return { ...getInitialPlaygroundConfig(), ...parsed }
  } catch {
    return getInitialPlaygroundConfig()
  }
}

function normalizeParameterEnabledField(value: unknown): ParameterEnabled {
  const fallback = getInitialParameterEnabled()
  if (!isRecord(value)) return fallback
  const result = { ...fallback }
  for (const key of Object.keys(result) as (keyof ParameterEnabled)[]) {
    const enabled = value[key]
    if (typeof enabled === 'boolean') result[key] = enabled
  }
  return result
}

function normalizeMessagesField(value: unknown): Message[] {
  try {
    const parsed = messagesSchema.parse(value) as Message[]
    return prepareLoadedMessages(parsed)
  } catch {
    return readLegacyMessages()
  }
}

function extractPersistedEnvelopeState(value: unknown): unknown {
  if (!isRecord(value)) return null
  if ('state' in value) return value.state
  return value
}

/**
 * Read the persisted playground store state. Prefers the versioned
 * `playground_store_v2` key; any unreadable field (or the whole key) falls
 * back to the legacy per-feature keys, never to silent data loss.
 */
export function loadPersistedPlaygroundState(): PersistedPlaygroundState {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(PLAYGROUND_STORE_STORAGE_KEY)
  } catch {
    raw = null
  }
  if (!raw) return readLegacyPlaygroundState()

  let envelope: unknown
  try {
    envelope = JSON.parse(raw)
  } catch {
    return readLegacyPlaygroundState()
  }

  const state = extractPersistedEnvelopeState(envelope)
  if (!isRecord(state)) return readLegacyPlaygroundState()

  const config = normalizeConfigField(state.config)
  let sessions = normalizeSessionsField(
    state.sessions,
    config.model,
    config.group
  )
  let activeSessionByModality = normalizeActiveSessionMap(
    state.activeSessionByModality
  )
  let activeModality = normalizeModality(state.activeModality)

  // v2 → v3: no sessions yet — import legacy global messages once.
  if (sessions.length === 0) {
    const legacyMessages = normalizeMessagesField(state.messages)
    const built = buildSessionsFromLegacyMessages(legacyMessages, config)
    sessions = built.sessions
    activeSessionByModality = {
      ...activeSessionByModality,
      ...built.activeSessionByModality,
    }
    if (!state.activeModality) {
      activeModality = built.activeModality
    }
  }

  // Ensure the active modality always has a session pointer.
  if (!activeSessionByModality[activeModality]) {
    const existing = sessions.find(
      (session) => session.modality === activeModality
    )
    if (existing) {
      activeSessionByModality = {
        ...activeSessionByModality,
        [activeModality]: existing.id,
      }
    } else {
      const draft = createEmptySession(
        activeModality,
        config.model,
        config.group
      )
      sessions = upsertSession(sessions, draft)
      activeSessionByModality = {
        ...activeSessionByModality,
        [activeModality]: draft.id,
      }
    }
  }

  return {
    workspaceMode: state.workspaceMode === 'duo' ? 'duo' : 'model',
    activeModality,
    config,
    parameterEnabled: normalizeParameterEnabledField(state.parameterEnabled),
    chatTools: normalizeChatTools(
      isRecord(state.chatTools)
        ? (state.chatTools as Partial<WorkbenchChatTools>)
        : null
    ),
    studioSettings: normalizeStudioSettings(state.studioSettings),
    duo: normalizeDuoConfig(state.duo),
    pinnedModels: stringArray(state.pinnedModels, MAX_PINNED_MODELS),
    messages: [],
    sessions,
    activeSessionByModality,
    ui: {
      settingsPanelOpen: isRecord(state.ui)
        ? state.ui.settingsPanelOpen !== false
        : true,
    },
  }
}
