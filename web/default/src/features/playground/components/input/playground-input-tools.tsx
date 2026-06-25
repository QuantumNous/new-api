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
import { GlobeIcon, PaperclipIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  PromptInputButton,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import {
  ATTACHMENT_ACTIONS,
  getAttachmentActionNotice,
  getSearchActionNotice,
} from '../../lib'

type PlaygroundInputToolsProps = {
  disabled?: boolean
  hasMessages?: boolean
  onClearMessages?: () => void
}

export function PlaygroundInputTools({
  disabled,
  hasMessages = false,
  onClearMessages,
}: PlaygroundInputToolsProps) {
  const { t } = useTranslation()
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)

  const handleFileAction = (action: string) => {
    const notice = getAttachmentActionNotice(action)
    toast.info(t(notice.title), {
      description: notice.description,
    })
  }

  const handleSearchAction = () => {
    const notice = getSearchActionNotice()
    toast.info(t(notice.title))
  }

  const handleClearMessages = () => {
    onClearMessages?.()
    setClearConfirmOpen(false)
    toast.success(t('Conversation cleared'))
  }

  return (
    <>
      <PromptInputTools>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <PromptInputButton
                className='border font-medium'
                disabled={disabled}
                variant='outline'
              />
            }
          >
            <PaperclipIcon size={16} />
            <span className='hidden sm:inline'>{t('Attach')}</span>
            <span className='sr-only sm:hidden'>{t('Attach')}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='start'>
            {ATTACHMENT_ACTIONS.map(({ action, icon: Icon, label }) => (
              <DropdownMenuItem
                key={action}
                onClick={() => handleFileAction(action)}
              >
                <Icon className='mr-2' size={16} />
                {t(label)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <PromptInputButton
          className='border font-medium'
          disabled={disabled}
          onClick={handleSearchAction}
          variant='outline'
        >
          <GlobeIcon size={16} />
          <span className='hidden sm:inline'>{t('Search')}</span>
          <span className='sr-only sm:hidden'>{t('Search')}</span>
        </PromptInputButton>

        <PromptInputButton
          className='text-muted-foreground hover:text-destructive border font-medium'
          disabled={disabled || !hasMessages || !onClearMessages}
          onClick={() => setClearConfirmOpen(true)}
          variant='outline'
        >
          <Trash2Icon size={16} />
          <span className='hidden sm:inline'>{t('Clear chat history')}</span>
          <span className='sr-only sm:hidden'>{t('Clear chat history')}</span>
        </PromptInputButton>
      </PromptInputTools>

      <ConfirmDialog
        destructive
        desc={t(
          'All playground messages saved in this browser will be removed. This cannot be undone.'
        )}
        confirmText={t('Clear')}
        handleConfirm={handleClearMessages}
        open={clearConfirmOpen}
        onOpenChange={setClearConfirmOpen}
        title={t('Clear chat history?')}
      />
    </>
  )
}
