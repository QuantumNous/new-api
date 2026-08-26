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
import { useState, type DragEvent, type KeyboardEvent } from 'react'
import {
  PaperclipIcon,
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
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

type AttachmentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  acceptedExtensions: string
}

function PlaygroundAttachmentDialog({
  open,
  onOpenChange,
  acceptedExtensions,
}: AttachmentDialogProps) {
  const { t } = useTranslation()
  const attachments = usePromptInputAttachments()
  const [isDragging, setIsDragging] = useState(false)

  const openFilePicker = () => attachments.openFileDialog()

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
    if (event.dataTransfer.files.length > 0) {
      attachments.add(event.dataTransfer.files)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openFilePicker()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('Upload files')}</DialogTitle>
          <DialogDescription>
            {t('Drag and drop files here, or choose from your device.')}
          </DialogDescription>
        </DialogHeader>

        <div
          aria-label={t('Upload files')}
          className={`flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
            isDragging
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-primary/60 hover:bg-muted/40'
          }`}
          onClick={openFilePicker}
          onDragEnter={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={(event) => {
            if (event.currentTarget === event.target) setIsDragging(false)
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          onKeyDown={handleKeyDown}
          role='button'
          tabIndex={0}
        >
          <PaperclipIcon className='text-muted-foreground size-8' />
          <div className='space-y-1'>
            <p className='font-medium'>{t('Upload files')}</p>
            <p className='text-muted-foreground text-xs'>
              {t('Supported file types: {{types}}', {
                types: acceptedExtensions,
              })}
            </p>
          </div>
          <Button
            type='button'
            variant='outline'
            onClick={(event) => {
              event.stopPropagation()
              openFilePicker()
            }}
          >
            {t('Choose files')}
          </Button>
        </div>

        <DialogFooter>
          <Button type='button' onClick={() => onOpenChange(false)}>
            {t('Done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [isAttachmentDialogOpen, setIsAttachmentDialogOpen] = useState(false)

  const isModelSelectDisabled = disabled || isModelLoading || modelLocked
  const isGroupSelectDisabled = disabled || groups.length === 0
  const isSubmitDisabled = disabled || submitDisabled || !modelValue
  const attachmentConfig =
    mediaProfile?.kind === 'video'
      ? {
          accept:
            'image/jpeg,image/png,image/webp,video/mp4,.jpg,.jpeg,.png,.webp,.mp4',
          extensions: '.jpg, .jpeg, .png, .webp, .mp4',
        }
      : mediaProfile?.kind === 'image'
        ? {
            accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp',
            extensions: '.jpg, .jpeg, .png, .webp',
          }
        : {
            accept:
              'application/pdf,text/csv,text/comma-separated-values,image/jpeg,image/png,image/webp,video/mp4,.pdf,.csv,.jpg,.jpeg,.png,.webp,.mp4',
            extensions: '.pdf, .csv, .jpg, .jpeg, .png, .webp, .mp4',
          }

  const handleSubmit = async (message: PromptInputMessage) => {
    if ((!message.text?.trim() && !message.files?.length) || isSubmitDisabled) {
      return
    }

    try {
      const attachments = await normalizePlaygroundAttachments(
        message.files ?? []
      )
      if (attachments.length && mediaProfile) {
        throw new Error('Attachments are supported only for chat models')
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
        accept={attachmentConfig.accept}
        groupClassName='rounded-xl bg-background dark:bg-background'
        maxFileSize={10 * 1024 * 1024}
        maxFiles={5}
        multiple
        onError={(error) => toast.error(error.message)}
        onSubmit={handleSubmit}
      >
        <PlaygroundAttachmentDialog
          acceptedExtensions={attachmentConfig.extensions}
          onOpenChange={setIsAttachmentDialogOpen}
          open={isAttachmentDialogOpen}
        />
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
            <PromptInputButton
              className='border font-medium'
              disabled={disabled}
              onClick={() => setIsAttachmentDialogOpen(true)}
              variant='outline'
            >
              <PaperclipIcon size={16} />
              <span className='hidden sm:inline'>{t('Attach')}</span>
              <span className='sr-only sm:hidden'>{t('Attach')}</span>
            </PromptInputButton>

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
