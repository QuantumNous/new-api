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
import { Loader2Icon, SendIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import { ModelGroupSelector } from '@/components/model-group-selector'
import { NativeSelect } from '@/components/ui/native-select'
import type { GroupOption, ImageGenerationConfig, ModelOption } from '../types'

interface PlaygroundImageInputProps {
  config: ImageGenerationConfig
  disabled?: boolean
  groups: GroupOption[]
  isGenerating?: boolean
  isModelLoading?: boolean
  models: ModelOption[]
  prompt: string
  onConfigChange: <K extends keyof ImageGenerationConfig>(
    key: K,
    value: ImageGenerationConfig[K]
  ) => void
  onPromptChange: (value: string) => void
  onSubmit: (prompt: string) => void
}

const sizeOptions = [
  'auto',
  '1024x1024',
  '1024x1536',
  '1536x1024',
  '1024x1792',
  '1792x1024',
  '1:1',
  '16:9',
  '9:16',
]

const qualityOptions: ImageGenerationConfig['quality'][] = [
  'auto',
  'standard',
  'hd',
  'low',
  'medium',
  'high',
]

const responseFormatOptions: ImageGenerationConfig['response_format'][] = [
  'url',
  'b64_json',
]

function FieldSelect({
  label,
  value,
  disabled,
  children,
  onChange,
}: {
  label: string
  value: string
  disabled?: boolean
  children: React.ReactNode
  onChange: (value: string) => void
}) {
  return (
    <label className='flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground'>
      <span className='shrink-0'>{label}</span>
      <NativeSelect
        className='h-8 w-28 text-xs'
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </NativeSelect>
    </label>
  )
}

export function PlaygroundImageInput({
  config,
  disabled,
  groups,
  isGenerating,
  isModelLoading = false,
  models,
  prompt,
  onConfigChange,
  onPromptChange,
  onSubmit,
}: PlaygroundImageInputProps) {
  const { t } = useTranslation()

  const isModelSelectDisabled =
    disabled || isModelLoading || models.length === 0
  const isGroupSelectDisabled = disabled || groups.length === 0

  const handleSubmit = (message: PromptInputMessage) => {
    if (!message.text?.trim() || disabled || isGenerating) return
    onSubmit(message.text)
    onPromptChange('')
  }

  return (
    <div className='grid shrink-0 gap-3 px-1 md:pb-4'>
      {!isModelLoading && models.length === 0 ? (
        <p className='px-2 text-xs text-muted-foreground'>
          {t('No image generation models available')}
        </p>
      ) : null}

      <PromptInput groupClassName='rounded-xl' onSubmit={handleSubmit}>
        <PromptInputTextarea
          autoComplete='off'
          autoCorrect='off'
          autoCapitalize='off'
          spellCheck={false}
          className='min-h-24 px-5 md:text-base'
          disabled={disabled || isGenerating}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder={t('Describe the image to generate')}
          value={prompt}
        />

        <PromptInputFooter className='flex-col items-stretch gap-2 p-2.5 sm:flex-row sm:items-center sm:justify-between'>
          <PromptInputTools className='flex-wrap'>
            <ModelGroupSelector
              selectedModel={config.model}
              models={models}
              onModelChange={(value) => onConfigChange('model', value)}
              selectedGroup={config.group}
              groups={groups}
              onGroupChange={(value) => onConfigChange('group', value)}
              disabled={isModelSelectDisabled || isGroupSelectDisabled}
            />

            <FieldSelect
              disabled={disabled || isGenerating}
              label={t('Size')}
              value={config.size}
              onChange={(value) => onConfigChange('size', value)}
            >
              {sizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </FieldSelect>

            <FieldSelect
              disabled={disabled || isGenerating}
              label={t('Quality')}
              value={config.quality}
              onChange={(value) =>
                onConfigChange(
                  'quality',
                  value as ImageGenerationConfig['quality']
                )
              }
            >
              {qualityOptions.map((quality) => (
                <option key={quality} value={quality}>
                  {quality}
                </option>
              ))}
            </FieldSelect>

            <FieldSelect
              disabled={disabled || isGenerating}
              label={t('Count')}
              value={String(config.n)}
              onChange={(value) =>
                onConfigChange(
                  'n',
                  Math.min(4, Math.max(1, Number.parseInt(value, 10) || 1))
                )
              }
            >
              {[1, 2, 3, 4].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </FieldSelect>

            <FieldSelect
              disabled={disabled || isGenerating}
              label={t('Format')}
              value={config.response_format}
              onChange={(value) =>
                onConfigChange(
                  'response_format',
                  value as ImageGenerationConfig['response_format']
                )
              }
            >
              {responseFormatOptions.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </FieldSelect>
          </PromptInputTools>

          <PromptInputButton
            className='text-foreground font-medium'
            disabled={
              disabled || isGenerating || !prompt.trim() || !config.model
            }
            type='submit'
            variant='secondary'
          >
            {isGenerating ? (
              <Loader2Icon className='animate-spin' size={16} />
            ) : (
              <SendIcon size={16} />
            )}
            <span className='hidden sm:inline'>
              {isGenerating ? t('Generating') : t('Generate')}
            </span>
            <span className='sr-only sm:hidden'>
              {isGenerating ? t('Generating') : t('Generate')}
            </span>
          </PromptInputButton>
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}
