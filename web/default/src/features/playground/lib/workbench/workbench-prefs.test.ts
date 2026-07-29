/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { describe, expect, it } from 'vitest'

import {
  BUILTIN_ASSISTANT_SYSTEM_PROMPT,
  DEFAULT_CHAT_TOOLS,
  normalizeChatTools,
} from './workbench-prefs'

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
