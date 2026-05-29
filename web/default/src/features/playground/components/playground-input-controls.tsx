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
import { SendIcon, SquareIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PromptInputButton } from '@/components/ai-elements/prompt-input'
import { ModelGroupSelector } from '@/components/model-group-selector'
import type { GroupOption, ModelOption } from '../types'

type PlaygroundInputControlsProps = {
  disabled?: boolean
  groups: GroupOption[]
  groupValue: string
  isGenerating?: boolean
  isModelLoading?: boolean
  models: ModelOption[]
  modelValue: string
  onGroupChange: (value: string) => void
  onModelChange: (value: string) => void
  onStop?: () => void
  text: string
}

export function PlaygroundInputControls({
  disabled,
  groups,
  groupValue,
  isGenerating,
  isModelLoading = false,
  models,
  modelValue,
  onGroupChange,
  onModelChange,
  onStop,
  text,
}: PlaygroundInputControlsProps) {
  const { t } = useTranslation()
  const isModelSelectDisabled =
    disabled || isModelLoading || models.length === 0
  const isGroupSelectDisabled = disabled || groups.length === 0

  return (
    <div className='flex items-center gap-1.5 md:gap-2'>
      <ModelGroupSelector
        selectedModel={modelValue}
        models={models}
        onModelChange={onModelChange}
        selectedGroup={groupValue}
        groups={groups}
        onGroupChange={onGroupChange}
        disabled={isModelSelectDisabled || isGroupSelectDisabled}
      />

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
  )
}
