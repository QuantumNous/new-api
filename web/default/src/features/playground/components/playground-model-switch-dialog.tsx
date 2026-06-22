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
import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  playgroundCancelButtonClassName,
  playgroundDialogDescriptionClassName,
  playgroundDialogTitleClassName,
  playgroundSaveButtonClassName,
} from '../lib/playground-ui-styles'

interface PlaygroundModelSwitchDialogProps {
  open: boolean
  pendingModelLabel?: string
  onOpenChange: (open: boolean) => void
  onKeepConversation: () => void
  onStartNewChat: () => void
}

export function PlaygroundModelSwitchDialog({
  open,
  pendingModelLabel,
  onOpenChange,
  onKeepConversation,
  onStartNewChat,
}: PlaygroundModelSwitchDialogProps) {
  const { t } = useTranslation()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className={playgroundDialogTitleClassName}>
            {t(
              'Switching models keeps the current conversation. Start a new chat?'
            )}
          </AlertDialogTitle>
          <AlertDialogDescription
            className={playgroundDialogDescriptionClassName}
          >
            {t(
              'Switching models keeps the current conversation. Start a new chat to avoid history affecting answers.'
            )}
            {pendingModelLabel ? (
              <>
                {' '}
                <span className='font-medium text-slate-800'>
                  {pendingModelLabel}
                </span>
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            className={playgroundCancelButtonClassName}
            onClick={onKeepConversation}
          >
            {t('Keep conversation')}
          </AlertDialogCancel>
          <AlertDialogAction
            className={playgroundSaveButtonClassName}
            onClick={onStartNewChat}
          >
            {t('Start new chat')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
