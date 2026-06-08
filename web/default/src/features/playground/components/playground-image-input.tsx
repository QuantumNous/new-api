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
import { NativeSelect } from '@/components/ui/native-select'
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import { ModelGroupSelector } from '@/components/model-group-selector'
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
  className,
  children,
  onChange,
}: {
  label: string
  value: string
  disabled?: boolean
  className?: string
  children: React.ReactNode
  onChange: (value: string) => void
}) {
  return (
    <label className='flex min-w-0 items-center gap-1.5 text-xs'>
      <span className='text-muted-foreground shrink-0'>{label}</span>
      <NativeSelect
        className={`${className ?? 'w-28 text-xs'} text-foreground`}
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

  const hasPrompt = Boolean(prompt.trim())
  const hasImageModels = models.length > 0
  const isConfigDisabled = Boolean(disabled || isGenerating)
  const isModelSelectDisabled =
    isConfigDisabled || isModelLoading || !hasImageModels
  const isGroupSelectDisabled = isConfigDisabled || groups.length === 0
  const isSubmitDisabled =
    Boolean(disabled || isGenerating) || !hasPrompt || !config.model

  const handleSubmit = (message: PromptInputMessage) => {
    if (!message.text?.trim() || disabled || isGenerating) return
    onSubmit(message.text)
    onPromptChange('')
  }

  return (
    <div className='grid shrink-0 gap-3 px-1 md:pb-4'>
      {!isModelLoading && models.length === 0 ? (
        <p className='text-muted-foreground px-2 text-xs'>
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
          disabled={isConfigDisabled || !hasImageModels}
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
              className='w-32 text-xs'
              disabled={isConfigDisabled || !hasImageModels}
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
              className='w-24 text-xs'
              disabled={isConfigDisabled || !hasImageModels}
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
              className='w-16 text-xs'
              disabled={isConfigDisabled || !hasImageModels}
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
              className='w-24 text-xs'
              disabled={isConfigDisabled || !hasImageModels}
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
            disabled={isSubmitDisabled}
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
