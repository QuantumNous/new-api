/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  BUILTIN_ASSISTANT_SYSTEM_PROMPT,
  DEFAULT_CHAT_TOOLS,
  DEFAULT_WORKBENCH_PREFS,
  loadWorkbenchPrefs,
  normalizeChatTools,
} from './workbench-prefs'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DEFAULT_CHAT_TOOLS', () => {
  it('ships with the built-in assistant system prompt', () => {
    expect(DEFAULT_CHAT_TOOLS.systemPrompt).toBe(
      BUILTIN_ASSISTANT_SYSTEM_PROMPT
    )
    expect(BUILTIN_ASSISTANT_SYSTEM_PROMPT.length).toBeGreaterThan(0)
  })
})

describe('normalizeChatTools', () => {
  it('fills blank system prompts with the built-in assistant prompt', () => {
    expect(normalizeChatTools({ systemPrompt: '' }).systemPrompt).toBe(
      BUILTIN_ASSISTANT_SYSTEM_PROMPT
    )
    expect(normalizeChatTools({ systemPrompt: '  \n' }).systemPrompt).toBe(
      BUILTIN_ASSISTANT_SYSTEM_PROMPT
    )
    expect(normalizeChatTools(null).systemPrompt).toBe(
      BUILTIN_ASSISTANT_SYSTEM_PROMPT
    )
  })

  it('keeps a custom persona when provided', () => {
    expect(
      normalizeChatTools({ systemPrompt: '  You are a pirate.  ' }).systemPrompt
    ).toBe('You are a pirate.')
  })
})

describe('loadWorkbenchPrefs', () => {
  it('returns detached defaults without structuredClone support', () => {
    vi.stubGlobal('localStorage', { getItem: () => null })
    vi.stubGlobal('structuredClone', undefined)

    const prefs = loadWorkbenchPrefs()

    prefs.pinnedModels.push('model-a')
    prefs.duo.answerModels.push('model-b')

    expect(DEFAULT_WORKBENCH_PREFS.pinnedModels).toEqual([])
    expect(DEFAULT_WORKBENCH_PREFS.duo.answerModels).toEqual([])
  })
})
