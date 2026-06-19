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
import { useState, useRef } from 'react'
import {
  PaperclipIcon,
  FileIcon,
  ImageIcon,
  SendIcon,
  SquareIcon,
  BarChartIcon,
  BoxIcon,
  NotepadTextIcon,
  CodeSquareIcon,
  GraduationCapIcon,
  Loader2Icon,
  XIcon,
  FileTextIcon,
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
  PromptInputButton,
  PromptInputFooter,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion'
import { ModelGroupSelector } from '@/components/model-group-selector'
import type { ModelOption, GroupOption } from '../types'
import { uploadFile } from '../api'

interface PlaygroundInputProps {
  onSubmit: (text: string, imageUrl?: string, fileContent?: string, fileName?: string) => void
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

const allowedImageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp']
const allowedTextExts = [
  '.txt', '.md', '.csv', '.json', '.xml', '.yaml', '.yml',
  '.log', '.py', '.js', '.ts', '.go', '.html', '.css',
  '.jsx', '.tsx', '.sh', '.bash', '.sql', '.toml', '.ini',
  '.rs', '.java', '.c', '.cpp', '.h', '.php', '.rb', '.swift',
]
// PDF is handled separately via text extraction
const allowedFileExts = [...allowedTextExts, '.pdf']

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
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)

  // Staged image: uploaded to R2, not yet sent
  const [stagedImage, setStagedImage] = useState<{
    url: string
    name: string
  } | null>(null)

  // Staged file: content read, shown as chip
  const [stagedFile, setStagedFile] = useState<{
    name: string
    content: string
    size: string
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const isModelSelectDisabled = disabled || isModelLoading || models.length === 0
  const isGroupSelectDisabled = disabled || groups.length === 0

  const handleSubmit = (message: PromptInputMessage) => {
    const msgText = message.text?.trim()
    if (!msgText && !stagedImage && !stagedFile) return
    if (disabled) return

    onSubmit(
      msgText || '',
      stagedImage?.url,
      stagedFile?.content,
      stagedFile?.name,
    )
    setText('')
    setStagedImage(null)
    setStagedFile(null)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleFileUpload = async (file: File, isImage: boolean) => {
    if (uploading) return

    const ext = '.' + file.name.split('.').pop()?.toLowerCase()

    if (isImage && !allowedImageExts.includes(ext)) {
      toast.error(t('Unsupported image format. Use: PNG, JPG, GIF, WebP'))
      return
    }
    if (!isImage && !allowedFileExts.includes(ext)) {
      toast.error(t('Unsupported file format'))
      return
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error(t('File too large. Maximum 20MB'))
      return
    }

    if (isImage) {
      // Upload image to R2 and STAGE it
      setUploading(true)
      try {
        const result = await uploadFile(file)
        if (result.success && result.data) {
          setStagedImage({ url: result.data.url, name: file.name })
          setStagedFile(null) // clear any staged file
          toast.success(t('Image attached. Add a message and press Send.'))
        } else {
          toast.error(result.message || t('Upload failed'))
        }
      } catch {
        toast.error(t('Upload failed'))
      } finally {
        setUploading(false)
      }
    } else {
      // Read file as text and stage as chip (not pasted into textarea)
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        setStagedFile({
          name: file.name,
          content: content.slice(0, 100000), // max 100k chars
          size: formatFileSize(file.size),
        })
        setStagedImage(null) // clear any staged image
        toast.success(t('File attached. Add a message and press Send.'))
      }
      reader.onerror = () => toast.error(t('Failed to read file'))
      // Try reading as text; for PDF this may yield garbled text but it's a fallback
      reader.readAsText(file)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    onSubmit(suggestion)
  }

  const canSend = !!(text.trim() || stagedImage || stagedFile)
  const hasAttachment = stagedImage || stagedFile

  return (
    <div className='grid shrink-0 gap-4 px-1 md:pb-4'>
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type='file'
        className='hidden'
        accept={allowedFileExts.join(',')}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFileUpload(file, false)
          e.target.value = ''
        }}
      />
      <input
        ref={imageInputRef}
        type='file'
        className='hidden'
        accept={allowedImageExts.join(',')}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFileUpload(file, true)
          e.target.value = ''
        }}
      />

      <PromptInput groupClassName='rounded-xl' onSubmit={handleSubmit}>
        {/* Attachment previews — right-aligned, compact, inside input box */}
        {hasAttachment && (
          <div className='flex items-end justify-end gap-2 px-4 pt-3'>
            {/* Image thumbnail — small, right-aligned */}
            {stagedImage && (
              <div className='relative ml-auto inline-flex h-14 w-14 shrink-0'>
                <img
                  src={stagedImage.url}
                  alt={stagedImage.name}
                  className='h-14 w-14 rounded-xl border object-cover shadow-sm'
                />
                <button
                  type='button'
                  onClick={() => setStagedImage(null)}
                  className='absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground/80 text-background hover:bg-destructive'
                >
                  <XIcon size={10} />
                </button>
              </div>
            )}

            {/* File chip — right-aligned */}
            {stagedFile && (
              <div className='relative ml-auto inline-flex max-w-[200px] items-center gap-2 rounded-xl border bg-muted/60 px-3 py-2 text-sm'>
                <FileTextIcon size={20} className='shrink-0 text-muted-foreground' />
                <div className='min-w-0'>
                  <div className='truncate text-xs font-medium'>{stagedFile.name}</div>
                  <div className='text-[10px] text-muted-foreground'>{stagedFile.size}</div>
                </div>
                <button
                  type='button'
                  onClick={() => setStagedFile(null)}
                  className='ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full hover:bg-destructive/10 hover:text-destructive'
                >
                  <XIcon size={10} />
                </button>
              </div>
            )}
          </div>
        )}

        <PromptInputTextarea
          autoComplete='off'
          autoCorrect='off'
          autoCapitalize='off'
          spellCheck={false}
          className='px-5 md:text-base'
          disabled={disabled || uploading}
          onChange={(event) => setText(event.target.value)}
          placeholder={
            stagedImage
              ? t('Add a message about this image...')
              : stagedFile
                ? t('Ask something about this file...')
                : t('Ask anything')
          }
          value={text}
        />

        <PromptInputFooter className='p-2.5'>
          <PromptInputTools>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <PromptInputButton
                    className='border font-medium'
                    disabled={disabled || uploading}
                    variant='outline'
                  />
                }
              >
                {uploading ? (
                  <Loader2Icon size={16} className='animate-spin' />
                ) : (
                  <PaperclipIcon size={16} />
                )}
                <span className='hidden sm:inline'>
                  {uploading ? t('Uploading...') : t('Attach')}
                </span>
                <span className='sr-only sm:hidden'>{t('Attach')}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='start'>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <FileIcon className='mr-2' size={16} />
                  {t('Upload file')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
                  <ImageIcon className='mr-2' size={16} />
                  {t('Upload photo')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </PromptInputTools>

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
                disabled={disabled || uploading || !canSend}
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
