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
  it('accepts both spellings of the document input modality', () => {
    expect(
      supportsNativeFileInput({
        model_name: 'gemini-3.1-pro-preview',
        input_modalities: ['text', 'image', 'pdf'],
      })
    ).toBe(true)
    expect(
      supportsNativeFileInput({
        model_name: 'some-private-model',
        input_modalities: ['text', 'file'],
      })
    ).toBe(true)
  })

  it('reads the tag list when modalities are unset', () => {
    expect(
      supportsNativeFileInput({
        model_name: 'claude-opus-5',
        tags: 'family:claude-opus,attachment,input:text,input:image,input:pdf',
      })
    ).toBe(true)
  })

  it('never infers file support from the model name', () => {
    expect(
      supportsNativeFileInput({
        model_name: 'gpt-5.6',
        input_modalities: ['text', 'image'],
      })
    ).toBe(false)
    expect(
      supportsNativeFileInput({
        model_name: 'gemini-3.5-flash',
        tags: 'family:gemini-flash,input:text',
      })
    ).toBe(false)
    expect(supportsNativeFileInput({ model_name: 'claude-sonnet-5' })).toBe(
      false
    )
  })

  it('treats an unknown model as unable to read files', () => {
    expect(supportsNativeFileInput()).toBe(false)
  })
})
