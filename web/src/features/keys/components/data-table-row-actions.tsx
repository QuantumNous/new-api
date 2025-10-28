import { useCallback } from 'react'
import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { type Row } from '@tanstack/react-table'
import { Trash2, Edit, Power, PowerOff, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
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
  const apiKey = apiKeySchema.parse(row.original)
  const { setOpen, setCurrentRow, triggerRefresh } = useApiKeys()
  const isEnabled = apiKey.status === API_KEY_STATUS.ENABLED
  const { chatPresets, serverAddress } = useChatPresets()

  const hasChatPresets = chatPresets.length > 0

  const handleOpenChatPreset = useCallback(
    (preset: ChatPreset) => {
      if (preset.type === 'fluent') {
        const success = sendToFluent(apiKey.key, serverAddress)
        if (success) {
          toast.success('Sent the API key to FluentRead.')
        } else {
          toast.info(
            'FluentRead extension not detected. Please ensure it is installed and active.'
          )
        }
        return
      }

      const resolvedUrl = resolveChatUrl({
        template: preset.url,
        apiKey: apiKey.key,
        serverAddress,
      })

      if (!resolvedUrl) {
        toast.error('Invalid chat link. Please contact your administrator.')
        return
      }

      if (typeof window === 'undefined') return

      try {
        window.open(resolvedUrl, '_blank', 'noopener')
      } catch {
        window.location.href = resolvedUrl
      }
    },
    [apiKey.key, serverAddress]
  )

  const handleToggleStatus = async () => {
    const newStatus = isEnabled
      ? API_KEY_STATUS.DISABLED
      : API_KEY_STATUS.ENABLED

    try {
      const result = await updateApiKeyStatus(apiKey.id, newStatus)
      if (result.success) {
        const message = isEnabled
          ? SUCCESS_MESSAGES.API_KEY_DISABLED
          : SUCCESS_MESSAGES.API_KEY_ENABLED
        toast.success(message)
        triggerRefresh()
      } else {
        toast.error(result.message || ERROR_MESSAGES.STATUS_UPDATE_FAILED)
      }
    } catch (_error) {
      toast.error(ERROR_MESSAGES.UNEXPECTED)
    }
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          className='data-[state=open]:bg-muted flex h-8 w-8 p-0'
        >
          <DotsHorizontalIcon className='h-4 w-4' />
          <span className='sr-only'>Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-[160px]'>
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(apiKey)
            setOpen('update')
          }}
        >
          Edit
          <DropdownMenuShortcut>
            <Edit size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleToggleStatus}>
          {isEnabled ? (
            <>
              Disable
              <DropdownMenuShortcut>
                <PowerOff size={16} />
              </DropdownMenuShortcut>
            </>
          ) : (
            <>
              Enable
              <DropdownMenuShortcut>
                <Power size={16} />
              </DropdownMenuShortcut>
            </>
          )}
        </DropdownMenuItem>
        {hasChatPresets && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Chat</DropdownMenuSubTrigger>
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
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(apiKey)
            setOpen('delete')
          }}
          className='text-destructive focus:text-destructive'
        >
          Delete
          <DropdownMenuShortcut>
            <Trash2 size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
