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
import {
  CameraIcon,
  FileIcon,
  GlobeIcon,
  ImageIcon,
  PaperclipIcon,
  ScreenShareIcon,
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
  PromptInputButton,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input'

type PlaygroundInputToolsProps = {
  disabled?: boolean
}

const attachmentActions = [
  { action: 'upload-file', icon: FileIcon, label: 'Upload file' },
  { action: 'upload-photo', icon: ImageIcon, label: 'Upload photo' },
  {
    action: 'take-screenshot',
    icon: ScreenShareIcon,
    label: 'Take screenshot',
  },
  { action: 'take-photo', icon: CameraIcon, label: 'Take photo' },
] as const

export function PlaygroundInputTools({ disabled }: PlaygroundInputToolsProps) {
  const { t } = useTranslation()

  const handleFileAction = (action: string) => {
    toast.info(t('Feature in development'), {
      description: action,
    })
  }

  return (
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
          {attachmentActions.map(({ action, icon: Icon, label }) => (
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
        onClick={() => toast.info(t('Search feature in development'))}
        variant='outline'
      >
        <GlobeIcon size={16} />
        <span className='hidden sm:inline'>{t('Search')}</span>
        <span className='sr-only sm:hidden'>{t('Search')}</span>
      </PromptInputButton>
    </PromptInputTools>
  )
}
