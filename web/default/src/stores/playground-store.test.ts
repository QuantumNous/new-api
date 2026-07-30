/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Message } from '@/features/playground/types'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('selectActiveChatMessages', () => {
  it('returns a stable store-owned snapshot even for legacy marker state', async () => {
    const stored = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    })
    const { selectActiveChatMessages, usePlaygroundStore } =
      await import('./playground-store')
    const messages: Message[] = [
      {
        key: 'legacy-model-switch',
        from: 'system',
        versions: [{ id: 'v1', content: 'old → new' }],
        modelChangeFrom: 'old',
        modelChangeTo: 'new',
        status: 'complete',
      },
    ]
    const state = {
      ...usePlaygroundStore.getState(),
      sessions: [
        {
          id: 'chat-1',
          modality: 'chat' as const,
          title: 'Chat',
          model: 'new',
          group: 'default',
          messages,
          kind: 'chat' as const,
          isDraft: false,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      activeSessionByModality: { chat: 'chat-1' },
    }

    expect(selectActiveChatMessages(state)).toBe(messages)
    expect(selectActiveChatMessages(state)).toBe(
      selectActiveChatMessages(state)
    )
  })
})
