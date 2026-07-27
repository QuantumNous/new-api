/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { describe, expect, it } from 'vitest'

import { supportsNativeFileInput } from './model-file-support'

describe('supportsNativeFileInput', () => {
  it('trusts explicit input modality metadata over the model name', () => {
    expect(
      supportsNativeFileInput({
        model_name: 'claude-opus-4',
        input_modalities: ['text', 'image'],
      })
    ).toBe(false)
    expect(
      supportsNativeFileInput({
        model_name: 'some-private-model',
        input_modalities: ['text', 'file'],
      })
    ).toBe(true)
  })

  it('falls back to known adaptor families when metadata is missing', () => {
    expect(supportsNativeFileInput({ model_name: 'gemini-3-pro' })).toBe(true)
    expect(supportsNativeFileInput({ model_name: 'gpt-5.6-luna' })).toBe(true)
    expect(supportsNativeFileInput({ model_name: 'deepseek-v4-flash' })).toBe(
      false
    )
  })

  it('treats an unknown model as unable to read files', () => {
    expect(supportsNativeFileInput()).toBe(false)
  })
})
