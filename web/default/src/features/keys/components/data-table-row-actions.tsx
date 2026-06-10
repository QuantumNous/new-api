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
import { useCallback, useState, type ReactNode } from 'react'
import { type Row } from '@tanstack/react-table'
import {
  Trash2,
  Edit,
  Power,
  PowerOff,
  ExternalLink,
  ArrowRightLeft,
  Loader2,
  MessageCircle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useChatPresets } from '@/features/chat/hooks/use-chat-presets'
import { resolveChatUrl, type ChatPreset } from '@/features/chat/lib/chat-links'
import { sendToFluent } from '@/features/chat/lib/send-to-fluent'
import { updateApiKeyStatus } from '../api'
import { API_KEY_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants'
import { apiKeySchema } from '../types'
import { useApiKeys } from './api-keys-provider'

type DataTableRowActionsProps<TData> = {
  row: Row<TData>
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const { t } = useTranslation()
  const apiKey = apiKeySchema.parse(row.original)
  const {
    setOpen,
    setCurrentRow,
    triggerRefresh,
    resolveRealKey,
  } = useApiKeys()
  const isEnabled = apiKey.status === API_KEY_STATUS.ENABLED
  const { chatPresets, serverAddress } = useChatPresets()
  const [isTogglingStatus, setIsTogglingStatus] = useState(false)

  const hasChatPresets = chatPresets.length > 0

  const handleOpenChatPreset = useCallback(
    async (preset: ChatPreset) => {
      const realKey = await resolveRealKey(apiKey.id)
      if (!realKey) return

      if (preset.type === 'fluent') {
        const success = sendToFluent(realKey, serverAddress)
        if (success) {
          toast.success(t('Sent the API key to FluentRead.'))
        } else {
          toast.info(
            t(
              'FluentRead extension not detected. Please ensure it is installed and active.'
            )
          )
        }
        return
      }

      const resolvedUrl = resolveChatUrl({
        template: preset.url,
        apiKey: realKey,
        serverAddress,
      })

      if (!resolvedUrl) {
        toast.error(t('Invalid chat link. Please contact your administrator.'))
        return
      }

      if (typeof window === 'undefined') return

      try {
        window.open(resolvedUrl, '_blank', 'noopener')
      } catch {
        window.location.href = resolvedUrl
      }
    },
    [resolveRealKey, apiKey.id, serverAddress, t]
  )

  const handleToggleStatus = async (
    e?: React.MouseEvent<HTMLButtonElement>
  ) => {
    e?.stopPropagation()
    const newStatus = isEnabled
      ? API_KEY_STATUS.DISABLED
      : API_KEY_STATUS.ENABLED

    setIsTogglingStatus(true)
    try {
      const result = await updateApiKeyStatus(apiKey.id, newStatus)
      if (result.success) {
        const message = isEnabled
          ? t(SUCCESS_MESSAGES.API_KEY_DISABLED)
          : t(SUCCESS_MESSAGES.API_KEY_ENABLED)
        toast.success(message)
        triggerRefresh()
      } else {
        toast.error(result.message || t(ERROR_MESSAGES.STATUS_UPDATE_FAILED))
      }
    } catch {
      toast.error(t(ERROR_MESSAGES.UNEXPECTED))
    } finally {
      setIsTogglingStatus(false)
    }
  }

  const handleOpenImport = () => {
    setCurrentRow(apiKey)
    setOpen('cc-switch')
  }

  let chatAction: ReactNode = null
  if (!hasChatPresets) {
    chatAction = (
      <Button variant='ghost' size='sm' disabled aria-label={t('Chat')}>
        <MessageCircle className='size-3.5' />
        {t('Chat')}
      </Button>
    )
  } else if (chatPresets.length === 1) {
    const preset = chatPresets[0]
    if (preset) {
      chatAction = (
        <Button
          variant='ghost'
          size='sm'
          onClick={() => handleOpenChatPreset(preset)}
          aria-label={t('Chat')}
        >
          <MessageCircle className='size-3.5' />
          {t('Chat')}
        </Button>
      )
    }
  } else {
    chatAction = (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          render={
            <Button
              variant='ghost'
              size='sm'
              className='data-popup-open:bg-muted'
              aria-label={t('Chat')}
            />
          }
        >
          <MessageCircle className='size-3.5' />
          {t('Chat')}
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          {chatPresets.map((preset) => (
            <DropdownMenuItem
              key={preset.id}
              onClick={() => handleOpenChatPreset(preset)}
            >
              {preset.name}
              {preset.type !== 'web' && (
                <ExternalLink className='ml-auto size-4' />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const statusLabel = isEnabled ? t('Disable') : t('Enable')
  const statusClassName = isEnabled
    ? 'text-destructive hover:text-destructive'
    : 'text-emerald-600 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-400'
  let statusIcon = <Power className='size-3.5' />
  if (isTogglingStatus) {
    statusIcon = <Loader2 className='size-3.5 animate-spin' />
  } else if (isEnabled) {
    statusIcon = <PowerOff className='size-3.5' />
  }

  return (
    <div className='flex items-center justify-end gap-1 whitespace-nowrap'>
      {chatAction}

      <Button
        variant='ghost'
        size='sm'
        onClick={handleOpenImport}
        aria-label={t('Import to CC Switch')}
      >
        <ArrowRightLeft className='size-3.5' />
        {t('Import')}
      </Button>

      <Button
        variant='ghost'
        size='sm'
        onClick={handleToggleStatus}
        disabled={isTogglingStatus}
        aria-label={statusLabel}
        className={statusClassName}
      >
        {statusIcon}
        {statusLabel}
      </Button>

      <Button
        variant='ghost'
        size='sm'
        onClick={() => {
          setCurrentRow(apiKey)
          setOpen('update')
        }}
        aria-label={t('Edit')}
      >
        <Edit className='size-3.5' />
        {t('Edit')}
      </Button>

      <Button
        variant='destructive'
        size='sm'
        onClick={() => {
          setCurrentRow(apiKey)
          setOpen('delete')
        }}
        aria-label={t('Delete')}
      >
        <Trash2 className='size-3.5' />
        {t('Delete')}
      </Button>
    </div>
  )
}
