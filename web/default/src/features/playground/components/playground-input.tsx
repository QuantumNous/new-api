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
import { useMemo, useState } from 'react'
import {
  PaperclipIcon,
  FileIcon,
  ImageIcon,
  ScreenShareIcon,
  CameraIcon,
  GlobeIcon,
  SendIcon,
  SquareIcon,
  BarChartIcon,
  BoxIcon,
  NotepadTextIcon,
  CodeSquareIcon,
  GraduationCapIcon,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion'
import { ModelGroupSelector } from '@/components/model-group-selector'
import { Input } from '@/components/ui/input'
import {
  IMAGE_QUALITY_OPTIONS,
  isImageGenerationEndpoint,
  validateImageSize,
} from '../lib/validation'
import { getEndpointDescription, getEndpointLabel } from '../lib'
import type { ModelOption, GroupOption, PlaygroundEndpoint } from '../types'

interface PlaygroundInputProps {
  onSubmit: (text: string) => void
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
  endpointValue: PlaygroundEndpoint
  inferredEndpoint: PlaygroundEndpoint
  onEndpointChange: (value: PlaygroundEndpoint) => void
  imageQuality: string
  imageSize: string
  onImageQualityChange: (value: string) => void
  onImageSizeChange: (value: string) => void
}

const suggestions = [
  { icon: BarChartIcon, text: 'Analyze data', color: '#76d0eb' },
  { icon: BoxIcon, text: 'Surprise me', color: '#76d0eb' },
  { icon: NotepadTextIcon, text: 'Summarize text', color: '#ea8444' },
  { icon: CodeSquareIcon, text: 'Code', color: '#6c71ff' },
  { icon: GraduationCapIcon, text: 'Get advice', color: '#76d0eb' },
  { icon: null, text: 'More' },
]

const endpointOptions: PlaygroundEndpoint[] = [
  'chat-completions',
  'responses',
  'claude-messages',
  'image-generations',
]

export function PlaygroundInput({
  onSubmit,
  onStop,
  disabled,
  isGenerating,
  models,
  modelValue,
  onModelChange,
  isModelLoading = false,
  groups,
  groupValue,
  onGroupChange,
  endpointValue,
  inferredEndpoint,
  onEndpointChange,
  imageQuality,
  imageSize,
  onImageQualityChange,
  onImageSizeChange,
}: PlaygroundInputProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')

  const isModelSelectDisabled =
    disabled || isModelLoading || models.length === 0
  const isGroupSelectDisabled = disabled || groups.length === 0
  const showImageOptions = isImageGenerationEndpoint(endpointValue)
  const imageSizeError = useMemo(
    () => (showImageOptions ? validateImageSize(imageSize) : null),
    [showImageOptions, imageSize]
  )

  const handleSubmit = (message: PromptInputMessage) => {
    if (!message.text?.trim() || disabled) return
    onSubmit(message.text)
    setText('')
  }

  const handleFileAction = (action: string) => {
    toast.info(t('Feature in development'), {
      description: action,
    })
  }

  const handleSuggestionClick = (suggestion: string) => {
    onSubmit(suggestion)
  }

  return (
    <div className='grid shrink-0 gap-4 px-1 md:pb-4'>
      <PromptInput groupClassName='rounded-xl' onSubmit={handleSubmit}>
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

        <div className='border-border flex flex-col gap-3 border-b px-2.5 pb-2.5'>
          <ModelGroupSelector
            selectedModel={modelValue}
            models={models}
            onModelChange={onModelChange}
            selectedGroup={groupValue}
            groups={groups}
            onGroupChange={onGroupChange}
            disabled={isModelSelectDisabled || isGroupSelectDisabled}
            className='flex-col items-stretch'
          />

          <div className='flex flex-col gap-1'>
            <span className='text-muted-foreground text-xs'>{t('Endpoint (auto inferred)')}</span>
            <Select
              value={endpointValue}
              onValueChange={(value) =>
                onEndpointChange(value as PlaygroundEndpoint)
              }
              disabled={disabled}
            >
              <SelectTrigger className='w-full justify-between' size='sm'>
                <SelectValue>{getEndpointLabel(endpointValue)}</SelectValue>
              </SelectTrigger>
              <SelectContent align='end' className='w-72 max-w-[calc(100vw-2rem)]'>
                {endpointOptions.map((endpoint) => (
                  <SelectItem key={endpoint} value={endpoint}>
                    <div className='flex flex-col gap-0.5'>
                      <span>{getEndpointLabel(endpoint)}</span>
                      <span className='text-muted-foreground text-xs'>
                        {endpoint === inferredEndpoint ? `${t('Auto inferred')} · ` : ''}
                        {getEndpointDescription(endpoint)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showImageOptions && (
            <>
              <div className='flex flex-col gap-1'>
                <span className='text-muted-foreground text-xs'>{t('Image quality')}</span>
                <Select
                  value={imageQuality}
                  onValueChange={onImageQualityChange}
                  disabled={disabled}
                >
                  <SelectTrigger className='w-full justify-between' size='sm'>
                    <SelectValue>{t(imageQuality)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent align='end'>
                    {IMAGE_QUALITY_OPTIONS.map((quality) => (
                      <SelectItem key={quality} value={quality}>
                        {t(quality)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='flex flex-col gap-1'>
                <span className='text-muted-foreground text-xs'>{t('Image size')}</span>
                <Input
                  aria-invalid={!!imageSizeError}
                  disabled={disabled}
                  onChange={(event) => onImageSizeChange(event.target.value)}
                  placeholder='1024x1024'
                  value={imageSize}
                />
                {imageSizeError && (
                  <span className='text-destructive text-xs'>
                    {t(imageSizeError)}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

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
                <DropdownMenuItem
                  onClick={() => handleFileAction('upload-file')}
                >
                  <FileIcon className='mr-2' size={16} />
                  {t('Upload file')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleFileAction('upload-photo')}
                >
                  <ImageIcon className='mr-2' size={16} />
                  {t('Upload photo')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleFileAction('take-screenshot')}
                >
                  <ScreenShareIcon className='mr-2' size={16} />
                  {t('Take screenshot')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleFileAction('take-photo')}
                >
                  <CameraIcon className='mr-2' size={16} />
                  {t('Take photo')}
                </DropdownMenuItem>
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
          </PromptInputTools>

          <div className='flex items-center gap-1.5 md:gap-2'>
            {isGenerating && onStop ? (
              <PromptInputButton
                className='text-foreground font-medium'
                onClick={onStop}
                variant='secondary'
              >
                <SquareIcon className='fill-current' size={16} />
                <span className='hidden sm:inline'>{t('Stop')}</span>
                <span className='sr-only sm:hidden'>{t('Stop')}</span>
              </PromptInputButton>
            ) : (
              <PromptInputButton
                className='text-foreground font-medium'
                disabled={disabled || !text.trim()}
                type='submit'
                variant='secondary'
              >
                <SendIcon size={16} />
                <span className='hidden sm:inline'>{t('Send')}</span>
                <span className='sr-only sm:hidden'>{t('Send')}</span>
              </PromptInputButton>
            )}
          </div>
        </PromptInputFooter>
      </PromptInput>

      <Suggestions>
        {suggestions.map(({ icon: Icon, text, color }) => (
          <Suggestion
            className={`text-xs font-normal sm:text-sm ${
              text === 'More' ? 'hidden sm:flex' : ''
            }`}
            key={text}
            onClick={() => handleSuggestionClick(text)}
            suggestion={text}
          >
            {Icon && <Icon size={16} style={{ color }} />}
            {text}
          </Suggestion>
        ))}
      </Suggestions>
    </div>
  )
}
