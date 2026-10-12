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
import { describe, expect, it } from 'vitest'

import { getInputControlState, getSubmittableInputText } from '../input-control-utils'
import type { ModelOption } from '../../../types'

const MODELS: ModelOption[] = [{ label: 'gpt-test', value: 'gpt-test' }]

function state(options: {
  attachmentCount?: number
  disabled?: boolean
  text?: string
}) {
  return getInputControlState({
    attachmentCount: options.attachmentCount ?? 0,
    disabled: options.disabled ?? false,
    groups: [],
    hasStopHandler: false,
    models: MODELS,
    text: options.text ?? '',
  })
}

describe('getInputControlState canSubmit', () => {
  it('allows submitting typed text', () => {
    expect(state({ text: 'hello' }).canSubmit).toBe(true)
  })

  it('blocks submitting when there is no content at all', () => {
    expect(state({}).canSubmit).toBe(false)
  })

  it('blocks whitespace-only text', () => {
    expect(state({ text: '   ' }).canSubmit).toBe(false)
  })

  it('allows submitting attachments with no typed text', () => {
    // Regression: attachments must be content on their own. Requiring text
    // made the Send button permanently disabled for file-only messages.
    expect(state({ attachmentCount: 1 }).canSubmit).toBe(true)
  })

  it('still blocks submit while disabled, even with attachments', () => {
    expect(state({ attachmentCount: 3, disabled: true }).canSubmit).toBe(false)
  })

  it('blocks submit when no model is available', () => {
    const result = getInputControlState({
      attachmentCount: 1,
      groups: [],
      hasStopHandler: false,
      models: [],
      text: '',
    })

    expect(result.canSubmit).toBe(false)
  })
})

describe('getSubmittableInputText', () => {
  it('returns the typed text unchanged', () => {
    expect(getSubmittableInputText({ text: 'hi' })).toBe('hi')
  })

  it('returns null for empty text with no attachments', () => {
    expect(getSubmittableInputText({ text: '' })).toBeNull()
  })

  it('returns empty string for empty text when attachments exist', () => {
    // The message still goes out; it simply carries no prompt text.
    expect(getSubmittableInputText({ text: '  ' }, false, true)).toBe('')
  })

  it('returns null when disabled regardless of attachments', () => {
    expect(getSubmittableInputText({ text: 'hi' }, true, true)).toBeNull()
  })
})
