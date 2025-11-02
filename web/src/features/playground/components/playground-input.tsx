import { useState } from 'react'
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
  CpuIcon,
  LayersIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
} from '@/components/ai-elements/prompt-input'
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion'
import type { ModelOption, GroupOption } from '../types'

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
}

const suggestions = [
  { icon: BarChartIcon, text: 'Analyze data', color: '#76d0eb' },
  { icon: BoxIcon, text: 'Surprise me', color: '#76d0eb' },
  { icon: NotepadTextIcon, text: 'Summarize text', color: '#ea8444' },
  { icon: CodeSquareIcon, text: 'Code', color: '#6c71ff' },
  { icon: GraduationCapIcon, text: 'Get advice', color: '#76d0eb' },
  { icon: null, text: 'More' },
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
}: PlaygroundInputProps) {
  const [text, setText] = useState('')

  const isModelSelectDisabled =
    disabled || isModelLoading || models.length === 0
  const isGroupSelectDisabled = disabled || groups.length === 0

  const handleSubmit = (message: PromptInputMessage) => {
    if (!message.text?.trim() || disabled) return
    onSubmit(message.text)
    setText('')
  }

  const handleFileAction = (action: string) => {
    toast.info('Feature in development', {
      description: action,
    })
  }

  const handleSuggestionClick = (suggestion: string) => {
    onSubmit(suggestion)
  }

  return (
    <div className='grid shrink-0 gap-4 px-1 py-4'>
      <PromptInput
        groupClassName='rounded-[20px] [--radius:20px]'
        onSubmit={handleSubmit}
      >
        <PromptInputTextarea
          className='px-5 md:text-base'
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          placeholder='Ask anything'
          value={text}
        />

        <PromptInputFooter className='p-2.5'>
          <PromptInputTools>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <PromptInputButton
                  className='!rounded-full border font-medium'
                  disabled={disabled}
                  variant='outline'
                >
                  <PaperclipIcon size={16} />
                  <span className='hidden sm:inline'>Attach</span>
                  <span className='sr-only sm:hidden'>Attach</span>
                </PromptInputButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='start'>
                <DropdownMenuItem
                  onClick={() => handleFileAction('upload-file')}
                >
                  <FileIcon className='mr-2' size={16} />
                  Upload file
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleFileAction('upload-photo')}
                >
                  <ImageIcon className='mr-2' size={16} />
                  Upload photo
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleFileAction('take-screenshot')}
                >
                  <ScreenShareIcon className='mr-2' size={16} />
                  Take screenshot
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleFileAction('take-photo')}
                >
                  <CameraIcon className='mr-2' size={16} />
                  Take photo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <PromptInputButton
              className='rounded-full border font-medium'
              disabled={disabled}
              onClick={() => toast.info('Search feature in development')}
              variant='outline'
            >
              <GlobeIcon size={16} />
              <span className='hidden sm:inline'>Search</span>
              <span className='sr-only sm:hidden'>Search</span>
            </PromptInputButton>
          </PromptInputTools>

          <div className='flex items-center gap-1.5 md:gap-2'>
            <PromptInputModelSelect
              disabled={isModelSelectDisabled}
              onValueChange={onModelChange}
              value={modelValue}
            >
              <PromptInputModelSelectTrigger
                aria-label='Model'
                className='text-foreground h-8 w-8 justify-center rounded-full border border-solid p-0 text-sm font-medium sm:w-auto sm:px-3 [&_[data-slot=select-value]]:hidden sm:[&_[data-slot=select-value]]:flex [&_svg:last-child]:hidden sm:[&_svg:last-child]:block'
              >
                {/* Mobile: icon-only */}
                <CpuIcon className='block size-4 sm:hidden' />
                {/* sm+: show label from value */}
                <PromptInputModelSelectValue
                  className='hidden truncate sm:block'
                  placeholder={isModelLoading ? 'Loading…' : 'Model'}
                />
              </PromptInputModelSelectTrigger>
              <PromptInputModelSelectContent>
                {models.map((model) => (
                  <PromptInputModelSelectItem
                    key={model.value}
                    value={model.value}
                  >
                    <span className='block truncate' title={model.label}>
                      {model.label}
                    </span>
                  </PromptInputModelSelectItem>
                ))}
              </PromptInputModelSelectContent>
            </PromptInputModelSelect>

            <PromptInputModelSelect
              disabled={isGroupSelectDisabled}
              onValueChange={onGroupChange}
              value={groupValue}
            >
              <PromptInputModelSelectTrigger
                aria-label='Group'
                className='text-foreground h-8 w-8 justify-center rounded-full border border-solid p-0 text-sm font-medium sm:w-auto sm:px-3 [&_[data-slot=select-value]]:hidden sm:[&_[data-slot=select-value]]:flex [&_svg:last-child]:hidden sm:[&_svg:last-child]:block'
              >
                {/* Mobile: icon-only */}
                <LayersIcon className='block size-4 sm:hidden' />
                {/* sm+: show only group name (label) */}
                <span
                  className='hidden truncate sm:block'
                  data-slot='select-value'
                >
                  {groups.find((g) => g.value === groupValue)?.label || 'Group'}
                </span>
              </PromptInputModelSelectTrigger>
              <PromptInputModelSelectContent>
                {groups.map((group) => (
                  <PromptInputModelSelectItem
                    key={group.value}
                    value={group.value}
                  >
                    <div className='flex flex-col'>
                      <span className='font-medium'>{group.label}</span>
                      {group.desc && (
                        <span className='text-muted-foreground text-xs'>
                          {group.desc} · Ratio: {group.ratio}
                        </span>
                      )}
                    </div>
                  </PromptInputModelSelectItem>
                ))}
              </PromptInputModelSelectContent>
            </PromptInputModelSelect>

            {isGenerating && onStop ? (
              <PromptInputButton
                className='text-foreground rounded-full font-medium'
                onClick={onStop}
                variant='secondary'
              >
                <SquareIcon className='fill-current' size={16} />
                <span className='hidden sm:inline'>Stop</span>
                <span className='sr-only sm:hidden'>Stop</span>
              </PromptInputButton>
            ) : (
              <PromptInputButton
                className='text-foreground rounded-full font-medium'
                disabled={disabled || !text.trim()}
                type='submit'
                variant='secondary'
              >
                <SendIcon size={16} />
                <span className='hidden sm:inline'>Send</span>
                <span className='sr-only sm:hidden'>Send</span>
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
