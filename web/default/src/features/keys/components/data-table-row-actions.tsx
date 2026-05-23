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
import { useCallback, useState } from 'react'
import { type Row } from '@tanstack/react-table'
import {
  Trash2,
  Edit,
  Power,
  PowerOff,
  ExternalLink,
  ArrowRightLeft,
  Copy,
  Link,
  Loader2,
  MoreHorizontal as DotsHorizontalIcon,
  Code2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useChatPresets } from '@/features/chat/hooks/use-chat-presets'
import { resolveChatUrl, type ChatPreset } from '@/features/chat/lib/chat-links'
import { sendToFluent } from '@/features/chat/lib/send-to-fluent'
import { updateApiKeyStatus } from '../api'
import { API_KEY_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants'
import {
  keysActionsCellClassName,
  keysDropdownMenuContentClassName,
  keysDropdownMenuItemClassName,
  keysDropdownMenuSeparatorClassName,
  keysDropdownMenuShortcutClassName,
  keysDropdownMenuSubContentClassName,
  keysDropdownMenuSubTriggerClassName,
  keysGhostIconButtonClassName,
  keysShowDevClientMenu,
  keysTooltipContentClassName,
} from '../lib/keys-ui-styles'
import { apiKeySchema } from '../types'
import { useApiKeys } from './api-keys-provider'

function getServerAddress(): string {
  try {
    const raw = localStorage.getItem('status')
    if (raw) {
      const status = JSON.parse(raw)
      if (status.server_address) return status.server_address as string
    }
  } catch {
    /* empty */
  }
  return window.location.origin
}

function encodeConnectionString(key: string, url: string): string {
  return JSON.stringify({
    _type: 'newapi_channel_conn',
    key,
    url,
  })
}

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
    setResolvedKey,
    resolveRealKey,
  } = useApiKeys()
  const isEnabled = apiKey.status === API_KEY_STATUS.ENABLED
  const { chatPresets, serverAddress } = useChatPresets()
  const [isTogglingStatus, setIsTogglingStatus] = useState(false)

  const showDevClientMenu = keysShowDevClientMenu && chatPresets.length > 0

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
        if (result.message) {
          // eslint-disable-next-line no-console
          console.warn('[keys]', result.message)
        }
        toast.error(t(ERROR_MESSAGES.STATUS_UPDATE_FAILED))
      }
    } catch {
      toast.error(t(ERROR_MESSAGES.UNEXPECTED))
    } finally {
      setIsTogglingStatus(false)
    }
  }

  return (
    <div className={keysActionsCellClassName}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={handleToggleStatus}
              disabled={isTogglingStatus}
              aria-label={
                isEnabled ? t('keys.action.disable') : t('keys.action.enable')
              }
              className={cn(
                keysGhostIconButtonClassName,
                isEnabled
                  ? 'text-rose-400 hover:text-rose-300'
                  : 'text-emerald-400 hover:text-emerald-300'
              )}
            />
          }
        >
          {isTogglingStatus ? (
            <Loader2 className='size-4 animate-spin' />
          ) : isEnabled ? (
            <PowerOff className='size-4' />
          ) : (
            <Power className='size-4' />
          )}
        </TooltipTrigger>
        <TooltipContent className={keysTooltipContentClassName}>
          {isEnabled ? t('keys.action.disable') : t('keys.action.enable')}
        </TooltipContent>
      </Tooltip>

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          render={
            <Button
              variant='ghost'
              className={cn(
                'flex size-8 p-0 data-popup-open:bg-white/10',
                keysGhostIconButtonClassName
              )}
            />
          }
        >
          <DotsHorizontalIcon className='size-4' />
          <span className='sr-only'>{t('keys.action.open_menu')}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align='end'
          className={keysDropdownMenuContentClassName}
        >
          <DropdownMenuItem
            className={keysDropdownMenuItemClassName}
            onClick={async () => {
              const realKey = await resolveRealKey(apiKey.id)
              if (!realKey) return
              const ok = await copyToClipboard(realKey)
              if (ok) toast.success(t('keys.toast.copied'))
            }}
          >
            {t('keys.action.copy')}
            <DropdownMenuShortcut className={keysDropdownMenuShortcutClassName}>
              <Copy size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem
            className={keysDropdownMenuItemClassName}
            onClick={async () => {
              const realKey = await resolveRealKey(apiKey.id)
              if (!realKey) return
              const connStr = encodeConnectionString(
                realKey,
                getServerAddress()
              )
              const ok = await copyToClipboard(connStr)
              if (ok) toast.success(t('keys.toast.copied'))
            }}
          >
            {t('keys.action.copy_connection')}
            <DropdownMenuShortcut className={keysDropdownMenuShortcutClassName}>
              <Link size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator
            className={keysDropdownMenuSeparatorClassName}
          />
          <DropdownMenuItem
            className={keysDropdownMenuItemClassName}
            onClick={() => {
              setCurrentRow(apiKey)
              setOpen('update')
            }}
          >
            {t('keys.action.edit')}
            <DropdownMenuShortcut className={keysDropdownMenuShortcutClassName}>
              <Edit size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          {showDevClientMenu && (
            <>
              <DropdownMenuSeparator
                className={keysDropdownMenuSeparatorClassName}
              />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger
                  className={keysDropdownMenuSubTriggerClassName}
                >
                  <Code2 className='size-4 text-slate-400' />
                  {t('keys.action.dev_clients')}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className={keysDropdownMenuSubContentClassName}
                >
                  {chatPresets.map((preset) => (
                    <DropdownMenuItem
                      key={preset.id}
                      className={keysDropdownMenuItemClassName}
                      onClick={() => handleOpenChatPreset(preset)}
                    >
                      {preset.name}
                      {preset.type !== 'web' && (
                        <DropdownMenuShortcut
                          className={keysDropdownMenuShortcutClassName}
                        >
                          <ExternalLink size={16} />
                        </DropdownMenuShortcut>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          )}
          <DropdownMenuSeparator
            className={keysDropdownMenuSeparatorClassName}
          />
          <DropdownMenuItem
            variant='destructive'
            className={keysDropdownMenuItemClassName}
            onClick={() => {
              setCurrentRow(apiKey)
              setOpen('delete')
            }}
          >
            {t('keys.action.delete')}
            <DropdownMenuShortcut className={keysDropdownMenuShortcutClassName}>
              <Trash2 size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
