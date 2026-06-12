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
import { useState, useRef, useEffect } from 'react'
import { SendIcon, SquareIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

interface PlaygroundInputProps {
  onSubmit: (text: string) => void
  onStop?: () => void
  disabled?: boolean
  isGenerating?: boolean
}

export function PlaygroundInput({
  onSubmit,
  onStop,
  disabled,
  isGenerating,
}: PlaygroundInputProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = () => {
    if (!text.trim() || disabled) return
    onSubmit(text)
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [text])

  return (
    <div className='flex items-end gap-2'>
      <Textarea
        ref={textareaRef}
        autoComplete='off'
        autoCorrect='off'
        autoCapitalize='off'
        spellCheck={false}
        className='min-h-[48px] max-h-[120px] resize-none rounded-[8px] border-border bg-card py-2.5 pr-4 text-sm focus:border-primary'
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('Enter a message... Press Enter to send, Shift+Enter for newline')}
        value={text}
        rows={1}
      />
      {isGenerating && onStop ? (
        <Button
          size='icon'
          variant='secondary'
          className='h-12 w-12 shrink-0 rounded-[6px]'
          onClick={onStop}
        >
          <SquareIcon className='size-4 fill-current' />
        </Button>
      ) : (
        <Button
          size='icon'
          className='h-12 w-12 shrink-0 rounded-[6px]'
          disabled={disabled || !text.trim()}
          onClick={handleSubmit}
        >
          <SendIcon className='size-4' />
        </Button>
      )}
    </div>
  )
}
