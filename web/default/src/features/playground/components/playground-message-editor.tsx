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
import { useEffect, useRef, type KeyboardEvent } from 'react'
import { Check, RotateCcw, Send, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { getMessageEditorState } from '../lib'
import type { Message } from '../types'

type PlaygroundMessageEditorProps = {
  editText: string
  message: Message
  onCancelEdit?: (open: boolean) => void
  onEditTextChange: (text: string) => void
  onSaveEdit?: (newContent: string) => void
  onSaveEditAndSubmit?: (newContent: string) => void
  originalText: string
}

export function PlaygroundMessageEditor({
  editText,
  message,
  onCancelEdit,
  onEditTextChange,
  onSaveEdit,
  onSaveEditAndSubmit,
  originalText,
}: PlaygroundMessageEditorProps) {
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { canSave, hasChanged, showSaveAndSubmit } = getMessageEditorState(
    message,
    editText,
    originalText
  )

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleCancel = () => {
    if (
      hasChanged &&
      !window.confirm(
        t('You have unsaved changes. Are you sure you want to leave?')
      )
    ) {
      return
    }

    onCancelEdit?.(false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      handleCancel()
      return
    }

    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      if (!canSave) return

      if (showSaveAndSubmit) {
        onSaveEditAndSubmit?.(editText)
      } else {
        onSaveEdit?.(editText)
      }
    }
  }

  return (
    <div className='rounded-lg border bg-background/80 p-2 shadow-sm'>
      <Textarea
        aria-label={t('Edit')}
        className='min-h-36 resize-y font-mono text-sm leading-6 md:min-h-48'
        onChange={(event) => onEditTextChange(event.target.value)}
        onKeyDown={handleKeyDown}
        ref={textareaRef}
        rows={8}
        value={editText}
      />

      <div className='mt-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
        <p className='text-xs text-muted-foreground'>
          {hasChanged ? t('Unsaved changes') : t('No changes')}
        </p>

        <div className='grid gap-2 sm:flex sm:justify-end'>
          {showSaveAndSubmit && (
            <Button
              className='max-md:min-h-11'
              disabled={!canSave}
              onClick={() => onSaveEditAndSubmit?.(editText)}
              size='sm'
            >
              <Send className='size-3.5' />
              {t('Save & Submit')}
            </Button>
          )}

          <Button
            className='max-md:min-h-11'
            disabled={!canSave}
            onClick={() => onSaveEdit?.(editText)}
            size='sm'
            variant={showSaveAndSubmit ? 'outline' : 'default'}
          >
            <Check className='size-3.5' />
            {t('Save')}
          </Button>

          {hasChanged && (
            <Button
              className='max-md:min-h-11'
              onClick={() => onEditTextChange(originalText)}
              size='sm'
              variant='outline'
            >
              <RotateCcw className='size-3.5' />
              {t('Reset')}
            </Button>
          )}

          <Button
            className='max-md:min-h-11'
            onClick={handleCancel}
            size='sm'
            variant='outline'
          >
            <X className='size-3.5' />
            {t('Cancel')}
          </Button>
        </div>
      </div>
    </div>
  )
}
