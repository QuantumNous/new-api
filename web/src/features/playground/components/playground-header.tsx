import { cn } from '@/lib/utils'
import {
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
} from '@/components/ai-elements/prompt-input'
import type { ModelOption } from '../types'

interface PlaygroundHeaderProps {
  models: ModelOption[]
  modelValue: string
  onModelChange: (value: string) => void
  isModelLoading?: boolean
  disabled?: boolean
}

export function PlaygroundHeader({
  models,
  modelValue,
  onModelChange,
  isModelLoading = false,
  disabled = false,
}: PlaygroundHeaderProps) {
  const isSelectDisabled = disabled || isModelLoading || models.length === 0

  return (
    <div className='flex items-center justify-between gap-4 border-b px-3 py-3'>
      <div className='flex items-center gap-3'>
        <PromptInputModelSelect
          disabled={isSelectDisabled}
          onValueChange={onModelChange}
          value={modelValue}
        >
          <PromptInputModelSelectTrigger
            className={cn(
              'bg-muted/50 text-foreground h-9 min-w-[200px] justify-between rounded-full border px-4 text-sm font-medium transition-colors',
              isSelectDisabled && 'opacity-70'
            )}
          >
            <PromptInputModelSelectValue
              placeholder={
                isModelLoading ? 'Loading models…' : 'Select a model'
              }
            />
          </PromptInputModelSelectTrigger>
          <PromptInputModelSelectContent>
            {models.map((model) => (
              <PromptInputModelSelectItem key={model.value} value={model.value}>
                {model.label}
              </PromptInputModelSelectItem>
            ))}
          </PromptInputModelSelectContent>
        </PromptInputModelSelect>
      </div>
    </div>
  )
}
