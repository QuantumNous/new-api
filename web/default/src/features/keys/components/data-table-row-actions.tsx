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
import { DashboardSpeed01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Row } from '@tanstack/react-table'
import {
  Trash2,
  Edit,
  Power,
  PowerOff,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import ccSwitchLogo from '@/assets/home/cc-switch-logo.png'
import { DataTableRowActionMenu } from '@/components/data-table/core/row-action-menu'
import { Button } from '@/components/ui/button'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuShortcut,
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
import { apiKeySchema } from '../types'
import { useApiKeys } from './api-keys-provider'

type DataTableRowActionsProps<TData> = {
  row: Row<TData>
}

type ResolvingAction = 'cc-switch' | null

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
    loadingKeys,
  } = useApiKeys()
  const isEnabled = apiKey.status === API_KEY_STATUS.ENABLED
  const { chatPresets, serverAddress } = useChatPresets()
  const [isTogglingStatus, setIsTogglingStatus] = useState(false)
  const [resolvingAction, setResolvingAction] = useState<ResolvingAction>(null)
  const isRealKeyLoading = Boolean(loadingKeys[apiKey.id])

  const hasChatPresets = chatPresets.length > 0
  const toggleLabel = isEnabled ? t('Disable') : t('Enable')
  const isApiTestDisabled = !isEnabled || !serverAddress.trim()
  let apiTestTooltip = t('Test API availability')
  if (!isEnabled) {
    apiTestTooltip = t('Disabled')
  } else if (!serverAddress.trim()) {
    apiTestTooltip = `${t('Base URL')}: ${t('Not available')}`
  }

  const handleOpenCCSwitch = useCallback(async () => {
    setResolvingAction('cc-switch')
    try {
      const realKey = await resolveRealKey(apiKey.id)
      if (!realKey) return

      setResolvedKey(realKey)
      setCurrentRow(apiKey)
      setOpen('cc-switch')
    } finally {
      setResolvingAction(null)
    }
  }, [apiKey, resolveRealKey, setCurrentRow, setOpen, setResolvedKey])

  const handleOpenApiTest = useCallback(() => {
    setResolvedKey('')
    setCurrentRow(apiKey)
    setOpen('api-test')
  }, [apiKey, setCurrentRow, setOpen, setResolvedKey])

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

  const handleToggleStatus = async () => {
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

  let statusIcon = <Power className='size-4' />
  if (isTogglingStatus) {
    statusIcon = <Loader2 className='size-4 animate-spin' />
  } else if (isEnabled) {
    statusIcon = <PowerOff className='size-4' />
  }

  return (
    <div className='-ml-1.5 flex items-center gap-1'>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={() => void handleOpenCCSwitch()}
              disabled={isRealKeyLoading}
              aria-label={t('Import to CC Switch')}
            />
          }
        >
          {resolvingAction === 'cc-switch' ? (
            <Loader2 className='size-4 animate-spin' />
          ) : (
            <img
              src={ccSwitchLogo}
              alt=''
              width={16}
              height={16}
              aria-hidden='true'
              decoding='async'
              className='size-4 rounded-[3px] object-contain'
            />
          )}
        </TooltipTrigger>
        <TooltipContent>{t('Import to CC Switch')}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className='inline-flex'
              tabIndex={isApiTestDisabled ? 0 : undefined}
              aria-label={isApiTestDisabled ? apiTestTooltip : undefined}
            />
          }
        >
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={handleOpenApiTest}
            disabled={isApiTestDisabled}
            aria-label={t('Test API availability')}
          >
            <HugeiconsIcon icon={DashboardSpeed01Icon} aria-hidden='true' />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{apiTestTooltip}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={() => {
                setCurrentRow(apiKey)
                setOpen('update')
              }}
              aria-label={t('Edit')}
            />
          }
        >
          <Edit />
        </TooltipTrigger>
        <TooltipContent>{t('Edit')}</TooltipContent>
      </Tooltip>

      <DataTableRowActionMenu
        ariaLabel={t('Open menu')}
        contentClassName='w-[200px]'
        modal={false}
      >
        {hasChatPresets && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{t('Chat')}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {chatPresets.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  onClick={() => handleOpenChatPreset(preset)}
                >
                  {preset.name}
                  {preset.type !== 'web' && (
                    <DropdownMenuShortcut>
                      <ExternalLink size={16} />
                    </DropdownMenuShortcut>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {hasChatPresets && <DropdownMenuSeparator />}
        <DropdownMenuItem
          onClick={() => void handleToggleStatus()}
          disabled={isTogglingStatus}
        >
          {toggleLabel}
          <DropdownMenuShortcut>{statusIcon}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(apiKey)
            setOpen('delete')
          }}
          className='text-destructive focus:text-destructive'
        >
          {t('Delete')}
          <DropdownMenuShortcut>
            <Trash2 size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DataTableRowActionMenu>
    </div>
  )
}
