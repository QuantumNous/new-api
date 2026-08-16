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
import type { GroupOption, ModelOption } from '../../types'

type InputControlStateOptions = {
  disabled?: boolean
  groups: GroupOption[]
  hasAttachments?: boolean
  hasStopHandler: boolean
  isGenerating?: boolean
  isModelLoading?: boolean
  models: ModelOption[]
  text: string
}

type InputControlState = {
  canSubmit: boolean
  isSelectorDisabled: boolean
  shouldShowStop: boolean
}

type SubmittableInputMessage = {
  text?: string | null
  files?: unknown[]
}

/**
 * Returns the text to submit, or `null` when the message cannot be submitted.
 * A message with attachments but no text is submittable with empty text.
 */
export function getSubmittableInputText(
  message: SubmittableInputMessage,
  disabled?: boolean
): string | null {
  if (disabled) {
    return null
  }

  if (message.text?.trim()) {
    return message.text
  }

  return message.files?.length ? '' : null
}

export function getInputControlState({
  disabled,
  groups,
  hasAttachments,
  hasStopHandler,
  isGenerating,
  isModelLoading,
  models,
  text,
}: InputControlStateOptions): InputControlState {
  const hasModels = models.length > 0
  const hasContent = text.trim().length > 0 || Boolean(hasAttachments)

  return {
    canSubmit: !disabled && hasModels && hasContent,
    isSelectorDisabled: disabled || isModelLoading || groups.length === 0,
    shouldShowStop: Boolean(isGenerating && hasStopHandler),
  }
}
