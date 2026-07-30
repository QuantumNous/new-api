/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_CONFIG, STORAGE_KEYS } from '../../constants'
import type { ChatAttachment, Message } from '../../types'
import { MAX_PERSISTED_ATTACHMENT_CHARS } from './storage-schema'
import {
  DEFAULT_STUDIO_SETTINGS,
  loadPersistedPlaygroundState,
  preparePersistedPlaygroundState,
  type PersistedPlaygroundState,
} from './store-migration'

function createLocalStorageStub() {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size
    },
  }
}

const userMessage: Message = {
  key: 'm1',
  from: 'user',
  versions: [{ id: 'v1', content: 'hello from legacy storage' }],
  status: 'complete',
}

function seedLegacyKeys() {
  localStorage.setItem(
    STORAGE_KEYS.CONFIG,
    JSON.stringify({
      version: 1,
      data: { model: 'claude-x', temperature: 0.3 },
    })
  )
  localStorage.setItem(
    STORAGE_KEYS.MESSAGES,
    JSON.stringify({ version: 1, data: [userMessage] })
  )
  localStorage.setItem(
    STORAGE_KEYS.PARAMETER_ENABLED,
    JSON.stringify({ version: 1, data: { seed: true } })
  )
  localStorage.setItem(
    STORAGE_KEYS.STUDIO,
    JSON.stringify({ settings: { imageCount: 99, voice: 'nova' } })
  )
  localStorage.setItem(
    STORAGE_KEYS.WORKBENCH,
    JSON.stringify({
      pinnedModels: ['gpt-4o', 42],
      chatTools: { webSearch: true, maxToolLoops: 50 },
      duo: { enabled: true, answerModels: ['a', 'b'], summaryModel: 's' },
    })
  )
}

function seedV2(state: Partial<PersistedPlaygroundState> | unknown) {
  localStorage.setItem(
    STORAGE_KEYS.STORE,
    JSON.stringify({ state, version: 2 })
  )
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createLocalStorageStub())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function chatMessagesFromSessions(state: {
  sessions: Array<{ modality: string; messages?: Message[] }>
}): Message[] {
  const chat = state.sessions.find((session) => session.modality === 'chat')
  return chat && 'messages' in chat && Array.isArray(chat.messages)
    ? chat.messages
    : []
}

describe('loadPersistedPlaygroundState', () => {
  it('returns defaults when no storage keys exist', () => {
    const state = loadPersistedPlaygroundState()
    expect(state.config).toEqual(DEFAULT_CONFIG)
    expect(state.messages).toEqual([])
    expect(state.sessions.length).toBeGreaterThanOrEqual(1)
    expect(state.activeModality).toBe('chat')
    expect(state.workspaceMode).toBe('model')
    expect(state.studioSettings).toEqual(DEFAULT_STUDIO_SETTINGS)
    expect(state.ui.settingsPanelOpen).toBe(true)
  })

  it('migrates the five legacy keys when the v2 key is missing', () => {
    seedLegacyKeys()
    const state = loadPersistedPlaygroundState()

    expect(state.config.model).toBe('claude-x')
    expect(state.config.temperature).toBe(0.3)
    expect(state.config.stream).toBe(DEFAULT_CONFIG.stream)
    expect(state.parameterEnabled.seed).toBe(true)
    const chatMessages = chatMessagesFromSessions(state)
    expect(chatMessages).toHaveLength(1)
    expect(chatMessages[0].versions[0].content).toBe(
      'hello from legacy storage'
    )
    // Studio values clamped on load, invalid pin entries dropped.
    // Image count is clamped to the GPT Image 2 max (4), not the old 10.
    expect(state.studioSettings.imageCount).toBe(4)
    expect(state.studioSettings.imageQuality).toBe('auto')
    expect(state.studioSettings.voice).toBe('nova')
    expect(state.pinnedModels).toEqual(['gpt-4o'])
    expect(state.chatTools.webSearch).toBe(true)
    expect(state.chatTools.maxToolLoops).toBe(20)
    // Legacy duo.enabled is dropped; duo config itself carries over.
    expect(state.workspaceMode).toBe('model')
    expect(state.duo).toEqual({ answerModels: ['a', 'b'], summaryModel: 's' })
  })

  it('never deletes the legacy keys during migration', () => {
    seedLegacyKeys()
    loadPersistedPlaygroundState()
    expect(localStorage.getItem(STORAGE_KEYS.MESSAGES)).not.toBeNull()
    expect(localStorage.getItem(STORAGE_KEYS.CONFIG)).not.toBeNull()
    expect(localStorage.getItem(STORAGE_KEYS.WORKBENCH)).not.toBeNull()
  })

  it('prefers a valid v2 key over legacy keys and imports messages into a session', () => {
    seedLegacyKeys()
    const v2Message: Message = {
      key: 'm2',
      from: 'assistant',
      versions: [{ id: 'v1', content: 'answer from v2' }],
      status: 'complete',
    }
    seedV2({
      workspaceMode: 'duo',
      config: { model: 'gemini-pro' },
      messages: [v2Message],
      pinnedModels: ['gemini-pro'],
      ui: { settingsPanelOpen: false },
    })

    const state = loadPersistedPlaygroundState()
    expect(state.config.model).toBe('gemini-pro')
    expect(state.workspaceMode).toBe('duo')
    const chatMessages = chatMessagesFromSessions(state)
    expect(chatMessages[0].versions[0].content).toBe('answer from v2')
    expect(state.pinnedModels).toEqual(['gemini-pro'])
    expect(state.ui.settingsPanelOpen).toBe(false)
  })

  it('falls back to legacy keys when the v2 key is corrupted JSON', () => {
    seedLegacyKeys()
    localStorage.setItem(STORAGE_KEYS.STORE, '{not valid json')

    const state = loadPersistedPlaygroundState()
    expect(state.config.model).toBe('claude-x')
    const chatMessages = chatMessagesFromSessions(state)
    expect(chatMessages[0].versions[0].content).toBe(
      'hello from legacy storage'
    )
  })

  it('falls back to legacy messages when only the v2 messages field is invalid', () => {
    seedLegacyKeys()
    seedV2({
      config: { model: 'gemini-pro' },
      messages: [{ key: 'broken', versions: 'not-an-array' }],
    })

    const state = loadPersistedPlaygroundState()
    // Valid v2 fields win; the unreadable messages field recovers from legacy.
    expect(state.config.model).toBe('gemini-pro')
    const chatMessages = chatMessagesFromSessions(state)
    expect(chatMessages).toHaveLength(1)
    expect(chatMessages[0].versions[0].content).toBe(
      'hello from legacy storage'
    )
  })

  it('keeps v3 sessions without re-importing legacy messages', () => {
    seedLegacyKeys()
    seedV2({
      workspaceMode: 'model',
      activeModality: 'chat',
      config: { model: 'gpt-4o' },
      messages: [],
      sessions: [
        {
          id: 's_keep',
          modality: 'chat',
          title: 'Kept session',
          model: 'gpt-4o',
          group: 'default',
          messages: [userMessage],
          isDraft: false,
          createdAt: 1,
          updatedAt: 2,
        },
      ],
      activeSessionByModality: { chat: 's_keep' },
      ui: { settingsPanelOpen: true },
    })
    localStorage.setItem(STORAGE_KEYS.LEGACY_MESSAGES_IMPORTED, '1')

    const state = loadPersistedPlaygroundState()
    expect(state.sessions).toHaveLength(1)
    expect(state.sessions[0].id).toBe('s_keep')
    expect(chatMessagesFromSessions(state)[0].versions[0].content).toBe(
      'hello from legacy storage'
    )
  })

  it('removes persisted legacy model-switch markers during hydration', () => {
    const marker: Message = {
      key: 'model-change-1',
      from: 'system',
      versions: [{ id: 'v1', content: 'old → new' }],
      modelChangeFrom: 'old',
      modelChangeTo: 'new',
      status: 'complete',
    }
    seedV2({
      workspaceMode: 'model',
      activeModality: 'chat',
      config: { model: 'new' },
      sessions: [
        {
          id: 's_with_marker',
          modality: 'chat',
          title: 'Migrated session',
          model: 'new',
          group: 'default',
          messages: [userMessage, marker],
          isDraft: false,
          createdAt: 1,
          updatedAt: 2,
        },
      ],
      activeSessionByModality: { chat: 's_with_marker' },
      ui: { settingsPanelOpen: true },
    })

    const state = loadPersistedPlaygroundState()

    expect(chatMessagesFromSessions(state)).toEqual([userMessage])
  })
})

describe('preparePersistedPlaygroundState', () => {
  function persistChatMessages(messages: Message[]) {
    const state = loadPersistedPlaygroundState()
    const chat = state.sessions.find((session) => session.modality === 'chat')
    if (!chat || chat.modality !== 'chat') {
      throw new Error('expected chat session')
    }
    chat.messages = messages
    const persisted = preparePersistedPlaygroundState(state)
    const persistedChat = persisted.sessions.find(
      (session) => session.modality === 'chat'
    )
    if (!persistedChat || persistedChat.modality !== 'chat') {
      throw new Error('expected persisted chat session')
    }
    return { live: chat, persisted, persistedChat }
  }

  it('keeps the asset reference but never the inline image bytes', () => {
    const result = persistChatMessages([
      {
        ...userMessage,
        attachments: [
          {
            id: 'img-9',
            name: 'shot.png',
            mimeType: 'image/png',
            dataUrl: 'data:image/png;base64,aW1n',
            assetId: 12,
            kind: 'image',
          },
        ],
      },
    ])

    expect(result.persistedChat.messages[0].attachments).toEqual([
      {
        id: 'img-9',
        name: 'shot.png',
        mimeType: 'image/png',
        dataUrl: undefined,
        assetId: 12,
        kind: 'image',
      },
    ])
    expect(result.live.messages[0].attachments?.[0]).toHaveProperty('dataUrl')
    expect(JSON.stringify(result.persisted)).not.toContain('data:image/png')
  })

  it('persists parsed documents without transient parse state', () => {
    const result = persistChatMessages([
      {
        ...userMessage,
        attachments: [
          {
            id: 'doc-9',
            name: 'report.pdf',
            mimeType: 'application/pdf',
            kind: 'document',
            text: 'parsed body',
            assetId: 3,
            status: 'done',
            ocrDone: 4,
            ocrTotal: 4,
          },
        ],
      },
    ])

    expect(result.persistedChat.messages[0].attachments).toEqual([
      {
        id: 'doc-9',
        name: 'report.pdf',
        mimeType: 'application/pdf',
        kind: 'document',
        text: 'parsed body',
        assetId: 3,
        status: undefined,
        error: undefined,
        ocrDone: undefined,
        ocrTotal: undefined,
      },
    ])
  })

  it('drops binary attachments that were never uploaded', () => {
    const result = persistChatMessages([
      {
        ...userMessage,
        attachments: [
          {
            id: 'img-1',
            name: 'shot.png',
            mimeType: 'image/png',
            dataUrl: 'data:image/png;base64,aW1n',
            kind: 'image',
          },
        ],
      },
    ])

    expect(result.persistedChat.messages[0].attachments).toBeUndefined()
  })

  it('keeps the newest extracted documents within the text budget', () => {
    const document = (id: string, size: number): ChatAttachment => ({
      id,
      kind: 'document',
      name: `${id}.txt`,
      mimeType: 'text/plain',
      text: 'x'.repeat(size),
    })
    const budget = MAX_PERSISTED_ATTACHMENT_CHARS

    const result = persistChatMessages([
      { ...userMessage, key: 'older', attachments: [document('old', budget)] },
      { ...userMessage, key: 'newer', attachments: [document('new', budget)] },
    ])

    expect(result.persistedChat.messages[0].attachments).toBeUndefined()
    expect(result.persistedChat.messages[1].attachments).toHaveLength(1)
  })

  it('never writes legacy model-switch markers back to storage', () => {
    const result = persistChatMessages([
      userMessage,
      {
        key: 'model-change-1',
        from: 'system',
        versions: [{ id: 'v1', content: 'old → new' }],
        modelChangeFrom: 'old',
        modelChangeTo: 'new',
        status: 'complete',
      },
    ])

    expect(result.persistedChat.messages).toEqual([userMessage])
  })
})
