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
import { Check, RotateCcw, Send, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CodeBlockEditor } from '@/components/ai-elements/code-block'
import { Button } from '@/components/design-system/button'

import { getMessageEditorState } from '../../lib'
import type { Message } from '../../types'

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
  const { canSave, hasChanged, showSaveAndSubmit } = getMessageEditorState(
    message,
    editText,
    originalText
  )

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

  const handleKeyDown = (event: KeyboardEvent) => {
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

  const editorActions = (
    <>
      {showSaveAndSubmit && (
        <Button
          aria-label={t('Save & Submit')}
          disabled={!canSave}
          onClick={() => onSaveEditAndSubmit?.(editText)}
          size='icon-sm'
          type='button'
        >
          <Send className='size-4' />
        </Button>
      )}

      <Button
        aria-label={t('Save')}
        disabled={!canSave}
        onClick={() => onSaveEdit?.(editText)}
        size='icon-sm'
        type='button'
        variant={showSaveAndSubmit ? 'ghost' : 'default'}
      >
        <Check className='size-4' />
      </Button>

      {hasChanged && (
        <Button
          aria-label={t('Reset')}
          onClick={() => onEditTextChange(originalText)}
          size='icon-sm'
          type='button'
          variant='ghost'
        >
          <RotateCcw className='size-4' />
        </Button>
      )}

      <Button
        aria-label={t('Cancel')}
        onClick={handleCancel}
        size='icon-sm'
        type='button'
        variant='ghost'
      >
        <X className='size-4' />
      </Button>
    </>
  )

  return (
    <CodeBlockEditor
      actions={editorActions}
      ariaLabel={t('Edit')}
      className='my-0 group-[.is-assistant]:w-full group-[.is-assistant]:max-w-[78ch] group-[.is-user]:max-w-[85%] sm:group-[.is-user]:max-w-[62ch] md:group-[.is-user]:max-w-[68ch] lg:group-[.is-user]:max-w-[72ch]'
      language='markdown'
      onChange={onEditTextChange}
      onKeyDown={handleKeyDown}
      rows={8}
      title={
        <span className='inline-flex items-center gap-2'>
          <span>{t('Edit')}</span>
          <span className='text-muted-foreground/80 normal-case'>
            {hasChanged ? t('Unsaved changes') : t('No changes')}
          </span>
        </span>
      }
      value={editText}
    />
  )
}
