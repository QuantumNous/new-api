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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  PromptInput,
  PromptInputFooter,
  PromptInputTextarea,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'

import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_SIZE_BYTES,
  PLAYGROUND_MODES,
} from '../../constants'
import {
  countUnsupportedFiles,
  getSubmittableInputText,
  toImageAttachments,
} from '../../lib'
import type {
  MessageAttachment,
  ModelOption,
  GroupOption,
  ParameterEnabled,
  PlaygroundConfig,
  PlaygroundMode,
} from '../../types'
import { PlaygroundInputAttachments } from './playground-input-attachments'
import { PlaygroundInputControls } from './playground-input-controls'
import { PlaygroundInputTools } from './playground-input-tools'

interface PlaygroundInputProps {
  config: PlaygroundConfig
  onSubmit: (payload: {
    text: string
    attachments?: MessageAttachment[]
  }) => void
  onStop?: () => void
  disabled?: boolean
  isGenerating?: boolean
  models: ModelOption[]
  modelValue: string
  onModelChange: (value: string) => void
  isModelLoading?: boolean
  groups: GroupOption[]
  groupValue: string
  onGroupChange: (value: string) => void
  onConfigChange: <K extends keyof PlaygroundConfig>(
    key: K,
    value: PlaygroundConfig[K]
  ) => void
  onModeChange: (mode: PlaygroundMode) => void
  onNewChat?: () => void
  onParameterEnabledChange: (
    key: keyof ParameterEnabled,
    value: boolean
  ) => void
  parameterEnabled: ParameterEnabled
}

export function PlaygroundInput(props: PlaygroundInputProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const isImageMode = props.config.mode === PLAYGROUND_MODES.IMAGE

  const appendText = (snippet: string) => {
    setText(
      (current) => (current.trim() ? `${current.trim()}\n\n` : '') + snippet
    )
  }

  const handleSubmit = (message: PromptInputMessage) => {
    const submittableText = getSubmittableInputText(message, props.disabled)

    if (submittableText === null) return

    if (isImageMode) {
      if (!submittableText.trim()) return
      props.onSubmit({ text: submittableText })
      setText('')
      return
    }

    const unsupportedCount = countUnsupportedFiles(message.files)
    if (unsupportedCount > 0) {
      toast.error(t('Only image attachments are supported'))
    }

    const attachments = toImageAttachments(message.files)
    if (!submittableText.trim() && attachments.length === 0) return

    props.onSubmit({ text: submittableText, attachments })
    setText('')
  }

  return (
    <div className='grid shrink-0 gap-4 px-1 md:pb-4'>
      <PromptInput
        accept={ATTACHMENT_ACCEPT}
        className='relative'
        groupClassName='bg-background/95 dark:bg-background/80 border-border/70 shadow-[0_18px_60px_-32px_rgba(0,0,0,0.65)] ring-1 ring-foreground/5 rounded-xl overflow-hidden transition-all duration-200 focus-within:border-primary/45 focus-within:ring-primary/15 focus-within:shadow-[0_22px_70px_-34px_rgba(0,0,0,0.75)]'
        maxFileSize={MAX_ATTACHMENT_SIZE_BYTES}
        maxFiles={MAX_ATTACHMENTS}
        onError={(error) => toast.error(error.message)}
        onSubmit={handleSubmit}
      >
        {!isImageMode && <PlaygroundInputAttachments />}

        <PromptInputTextarea
          autoComplete='off'
          autoCorrect='off'
          autoCapitalize='off'
          spellCheck={false}
          className='min-h-20 px-5 pt-4 pb-3 leading-7 md:min-h-24 md:text-base'
          disabled={props.disabled}
          onChange={(event) => setText(event.target.value)}
          placeholder={
            isImageMode
              ? t('Describe the image you want to generate')
              : t('Ask anything')
          }
          value={text}
        />

        <PromptInputFooter className='border-border/60 bg-muted/20 dark:bg-muted/10 border-t px-3 py-2.5 backdrop-blur'>
          <PlaygroundInputControls
            disabled={props.disabled}
            groups={props.groups}
            groupValue={props.groupValue}
            isGenerating={props.isGenerating}
            isModelLoading={props.isModelLoading}
            models={props.models}
            modelValue={props.modelValue}
            onGroupChange={props.onGroupChange}
            onModelChange={props.onModelChange}
            onStop={props.onStop}
            text={text}
            tools={
              <PlaygroundInputTools
                config={props.config}
                disabled={props.disabled}
                onAppendText={appendText}
                onConfigChange={props.onConfigChange}
                onModeChange={props.onModeChange}
                onNewChat={props.onNewChat}
                onParameterEnabledChange={props.onParameterEnabledChange}
                parameterEnabled={props.parameterEnabled}
              />
            }
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}
