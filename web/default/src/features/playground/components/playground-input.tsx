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
import { useState, type ComponentType, type ReactNode } from 'react'
import {
  PaperclipIcon,
  FileIcon,
  ImageIcon,
  GlobeIcon,
  SendIcon,
  SquareIcon,
  BarChartIcon,
  BoxIcon,
  NotepadTextIcon,
  CodeSquareIcon,
  GraduationCapIcon,
  VideoIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  PromptInput,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion'
import { ModelGroupSelector } from '@/components/model-group-selector'
import {
  isQuickStartModelAvailable,
  QUICK_START_MODELS,
  resolveQuickStartChatModel,
  shouldShowQuickStartSuggestions,
  type MediaGenerationProfile,
  type MediaGenerationSettings,
  type MediaParameterKey,
  type MediaParameterValue,
  normalizePlaygroundAttachments,
  validateMediaGenerationAttachments,
} from '../lib'
import type { GroupOption, ModelOption, PlaygroundAttachment } from '../types'
import { PlaygroundParameters } from './playground-parameters'

interface PlaygroundInputProps {
  onSubmit: (
    text: string,
    model?: string,
    attachments?: PlaygroundAttachment[]
  ) => void
  onStop?: () => void
  disabled?: boolean
  submitDisabled?: boolean
  isGenerating?: boolean
  models: ModelOption[]
  modelValue: string
  onModelChange: (value: string) => void
  isModelLoading?: boolean
  modelLocked?: boolean
  groups: GroupOption[]
  groupValue: string
  onGroupChange: (value: string) => void
  showGroupSelector?: boolean
  initialText?: string
  mediaProfile?: MediaGenerationProfile
  mediaSettings?: MediaGenerationSettings
  onMediaParameterChange?: (
    key: MediaParameterKey,
    value: MediaParameterValue
  ) => void
}

const suggestions: Array<{
  icon: typeof BarChartIcon | null
  text: string
  color?: string
  model?: string
}> = [
  {
    icon: ImageIcon,
    text: 'Create an image',
    color: '#ea8444',
    model: QUICK_START_MODELS.image,
  },
  {
    icon: VideoIcon,
    text: 'Generate a video',
    color: '#6c71ff',
    model: QUICK_START_MODELS.video,
  },
  { icon: BarChartIcon, text: 'Analyze data', color: '#76d0eb' },
  { icon: BoxIcon, text: 'Surprise me', color: '#76d0eb' },
  {
    icon: NotepadTextIcon,
    text: 'Summarize text',
    color: '#ea8444',
  },
  {
    icon: CodeSquareIcon,
    text: 'Code',
    color: '#6c71ff',
  },
  {
    icon: GraduationCapIcon,
    text: 'Get advice',
    color: '#76d0eb',
  },
  { icon: null, text: 'More' },
]

function PlaygroundAttachmentMenuItem({
  icon: Icon,
  children,
}: {
  icon: ComponentType<{ className?: string; size?: number }>
  children: ReactNode
}) {
  const attachments = usePromptInputAttachments()

  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.preventDefault()
        attachments.openFileDialog()
      }}
    >
      <Icon className='mr-2' size={16} />
      {children}
    </DropdownMenuItem>
  )
}

function PlaygroundAttachmentPreviews() {
  const attachments = usePromptInputAttachments()
  if (attachments.files.length === 0) return null

  return (
    <div className='flex w-full flex-wrap gap-1.5'>
      <PromptInputAttachments>
        {(attachment) => <PromptInputAttachment data={attachment} />}
      </PromptInputAttachments>
    </div>
  )
}

function PlaygroundSubmitButton({
  disabled,
  isGenerating,
  isSubmitDisabled,
  onStop,
  text,
}: {
  disabled?: boolean
  isGenerating?: boolean
  isSubmitDisabled: boolean
  onStop?: () => void
  text: string
}) {
  const { t } = useTranslation()
  const attachments = usePromptInputAttachments()

  if (isGenerating && onStop) {
    return (
      <PromptInputButton
        className='text-foreground font-medium'
        onClick={onStop}
        variant='secondary'
      >
        <SquareIcon className='fill-current' size={16} />
        <span className='hidden sm:inline'>{t('Stop')}</span>
        <span className='sr-only sm:hidden'>{t('Stop')}</span>
      </PromptInputButton>
    )
  }

  return (
    <PromptInputButton
      className='text-foreground font-medium'
      disabled={
        disabled ||
        isSubmitDisabled ||
        (!text.trim() && attachments.files.length === 0)
      }
      type='submit'
      variant='secondary'
    >
      <SendIcon size={16} />
      <span className='hidden sm:inline'>Send</span>
      <span className='sr-only sm:hidden'>Send</span>
    </PromptInputButton>
  )
}

export function PlaygroundInput({
  onSubmit,
  onStop,
  disabled,
  submitDisabled,
  isGenerating,
  models,
  modelValue,
  onModelChange,
  isModelLoading = false,
  modelLocked = false,
  groups,
  groupValue,
  onGroupChange,
  showGroupSelector = true,
  initialText,
  mediaProfile,
  mediaSettings,
  onMediaParameterChange,
}: PlaygroundInputProps) {
  const { t } = useTranslation()
  const [text, setText] = useState(() => initialText?.trim() ?? '')

  const isModelSelectDisabled = disabled || isModelLoading || modelLocked
  const isGroupSelectDisabled = disabled || groups.length === 0
  const isSubmitDisabled = disabled || submitDisabled || !modelValue

  const handleSubmit = async (message: PromptInputMessage) => {
    if ((!message.text?.trim() && !message.files?.length) || isSubmitDisabled) {
      return
    }

    try {
      const attachments = await normalizePlaygroundAttachments(
        message.files ?? []
      )
      if (mediaProfile) {
        const attachmentError = validateMediaGenerationAttachments(
          modelValue,
          attachments
        )
        if (attachmentError) throw new Error(attachmentError)
      }
      onSubmit(message.text ?? '', undefined, attachments)
      setText('')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unable to process attachment'
      toast.error(t(errorMessage))
      throw error
    }
  }

  const handleSuggestionClick = (suggestion: string, model?: string) => {
    if (isSubmitDisabled) return
    const targetModel = model ?? resolveQuickStartChatModel(models)
    if (!targetModel) return
    if (model && !isQuickStartModelAvailable(models, model)) return
    onModelChange(targetModel)
    onSubmit(suggestion, targetModel)
  }

  const textQuickStartModel = resolveQuickStartChatModel(models)

  return (
    <div className='grid shrink-0 gap-4 px-1 md:pb-4'>
      <PromptInput
        accept='image/*,video/mp4,.mp4,.txt,.md,.csv,.json'
        groupClassName='rounded-xl'
        maxFileSize={10 * 1024 * 1024}
        maxFiles={5}
        multiple
        onError={(error) => toast.error(error.message)}
        onSubmit={handleSubmit}
      >
        <PromptInputHeader className='p-2.5 pb-0'>
          <PlaygroundAttachmentPreviews />
        </PromptInputHeader>
        <PromptInputTextarea
          autoComplete='off'
          autoCorrect='off'
          autoCapitalize='off'
          spellCheck={false}
          className='px-5 md:text-base'
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('Ask anything')}
          value={text}
        />

        <PromptInputFooter className='p-2.5'>
          <PromptInputTools>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <PromptInputButton
                    className='border font-medium'
                    disabled={disabled}
                    variant='outline'
                  />
                }
              >
                <PaperclipIcon size={16} />
                <span className='hidden sm:inline'>{t('Attach')}</span>
                <span className='sr-only sm:hidden'>{t('Attach')}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='start'>
                <PlaygroundAttachmentMenuItem icon={FileIcon}>
                  {t('Upload file')}
                </PlaygroundAttachmentMenuItem>
                <PlaygroundAttachmentMenuItem icon={ImageIcon}>
                  {t('Upload photo')}
                </PlaygroundAttachmentMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <PromptInputButton
              className='border font-medium'
              disabled={disabled}
              onClick={() => toast.info(t('Search feature in development'))}
              variant='outline'
            >
              <GlobeIcon size={16} />
              <span className='hidden sm:inline'>{t('Search')}</span>
              <span className='sr-only sm:hidden'>{t('Search')}</span>
            </PromptInputButton>

            {mediaProfile && mediaSettings && onMediaParameterChange && (
              <PlaygroundParameters
                disabled={disabled}
                model={modelValue}
                onChange={onMediaParameterChange}
                profile={mediaProfile}
                settings={mediaSettings}
              />
            )}
          </PromptInputTools>

          <div className='flex items-center gap-1.5 md:gap-2'>
            <ModelGroupSelector
              selectedModel={modelValue}
              models={models}
              onModelChange={onModelChange}
              selectedGroup={groupValue}
              groups={groups}
              onGroupChange={onGroupChange}
              showGroupSelector={showGroupSelector}
              disabled={
                isModelSelectDisabled ||
                (showGroupSelector && isGroupSelectDisabled)
              }
            />

            <PlaygroundSubmitButton
              disabled={disabled}
              isGenerating={isGenerating}
              isSubmitDisabled={isSubmitDisabled}
              onStop={onStop}
              text={text}
            />
          </div>
        </PromptInputFooter>
      </PromptInput>

      {shouldShowQuickStartSuggestions(text) && (
        <div className='grid gap-2'>
          <p className='text-muted-foreground px-1 text-xs'>
            {t('Try one of these to get started:')}
          </p>
          <Suggestions>
            {suggestions
              .filter((suggestion) =>
                suggestion.model
                  ? isQuickStartModelAvailable(models, suggestion.model)
                  : !!textQuickStartModel
              )
              .map(({ icon: Icon, text: suggestionText, color, model }) => (
                <Suggestion
                  className={`text-xs font-normal sm:text-sm ${
                    suggestionText === 'More' ? 'hidden sm:flex' : ''
                  }`}
                  key={suggestionText}
                  onClick={() =>
                    handleSuggestionClick(t(suggestionText), model)
                  }
                  suggestion={t(suggestionText)}
                >
                  {Icon && <Icon size={16} style={{ color }} />}
                  {t(suggestionText)}
                </Suggestion>
              ))}
          </Suggestions>
        </div>
      )}
    </div>
  )
}
