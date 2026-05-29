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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MESSAGE_ROLES } from '../constants'
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
  const isEmpty = useMemo(() => !editText.trim(), [editText])
  const isChanged = useMemo(
    () => editText !== originalText,
    [editText, originalText]
  )

  return (
    <div className='space-y-2'>
      <Textarea
        value={editText}
        onChange={(event) => onEditTextChange(event.target.value)}
        className='font-mono text-sm'
        rows={8}
      />
      <div className='flex gap-2'>
        {message.from === MESSAGE_ROLES.USER && (
          <Button
            size='sm'
            onClick={() => onSaveEditAndSubmit?.(editText)}
            disabled={isEmpty || !isChanged}
          >
            {t('Save & Submit')}
          </Button>
        )}
        <Button
          size='sm'
          onClick={() => onSaveEdit?.(editText)}
          disabled={isEmpty || !isChanged}
        >
          {t('Save')}
        </Button>
        <Button
          size='sm'
          variant='outline'
          onClick={() => onCancelEdit?.(false)}
        >
          {t('Cancel')}
        </Button>
      </div>
    </div>
  )
}
