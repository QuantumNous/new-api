import { useState } from 'react'
import {
  PaperclipIcon,
  FileIcon,
  ImageIcon,
  ScreenShareIcon,
  CameraIcon,
  GlobeIcon,
  AudioWaveformIcon,
  SquareIcon,
  BarChartIcon,
  BoxIcon,
  NotepadTextIcon,
  CodeSquareIcon,
  GraduationCapIcon,
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
    toast.info('功能开发中', {
      description: action,
    })
  }

  const handleSuggestionClick = (suggestion: string) => {
    onSubmit(suggestion)
  }

  return (
    <div className='grid shrink-0 gap-4 p-4'>
      <PromptInput
        className='divide-y-0 rounded-[28px]'
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
              onClick={() => toast.info('搜索功能开发中')}
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
              <PromptInputModelSelectTrigger className='max-w-[100px] text-xs sm:max-w-[140px] sm:text-sm md:max-w-none md:text-base'>
                <PromptInputModelSelectValue
                  className='truncate'
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
              <PromptInputModelSelectTrigger className='max-w-[80px] text-xs sm:max-w-[120px] sm:text-sm md:max-w-none md:text-base'>
                <PromptInputModelSelectValue
                  className='truncate'
                  placeholder='Group'
                />
              </PromptInputModelSelectTrigger>
              <PromptInputModelSelectContent>
                {groups.map((group) => (
                  <PromptInputModelSelectItem
                    key={group.value}
                    value={group.value}
                  >
                    <span className='block truncate' title={group.label}>
                      {group.label}
                    </span>
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
                disabled={disabled}
                onClick={() => toast.info('语音功能开发中')}
                variant='secondary'
              >
                <AudioWaveformIcon size={16} />
                <span className='hidden sm:inline'>Voice</span>
                <span className='sr-only sm:hidden'>Voice</span>
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
