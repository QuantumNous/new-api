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
import { useChatPresets } from '@/features/chat/hooks/use-chat-presets'

import { ApiKeysDeleteDialog } from './api-keys-delete-dialog'
import { ApiKeysMutateDrawer } from './api-keys-mutate-drawer'
import { useApiKeys } from './api-keys-provider'
import { ApiKeyAvailabilityDialog } from './dialogs/api-key-availability-dialog'
import { CCSwitchDialog } from './dialogs/cc-switch-dialog'

export function ApiKeysDialogs() {
  const { open, setOpen, currentRow, resolvedKey, setResolvedKey } =
    useApiKeys()
  const { serverAddress } = useChatPresets()
  const normalizedServerAddress = serverAddress.trim().replace(/\/+$/, '')
  const apiBaseUrl = normalizedServerAddress
    ? `${normalizedServerAddress}/v1`
    : ''

  const handleCredentialDialogOpenChange = (isOpen: boolean) => {
    if (isOpen) return
    setResolvedKey('')
    setOpen(null)
  }

  return (
    <>
      <ApiKeysMutateDrawer
        open={open === 'create' || open === 'update'}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        currentRow={open === 'update' ? currentRow || undefined : undefined}
      />
      <ApiKeysDeleteDialog />
      <CCSwitchDialog
        open={open === 'cc-switch'}
        onOpenChange={handleCredentialDialogOpenChange}
        apiKey={currentRow}
        apiBaseUrl={apiBaseUrl}
        serverAddress={normalizedServerAddress}
        tokenKey={resolvedKey}
      />
      <ApiKeyAvailabilityDialog
        open={open === 'api-test'}
        onOpenChange={handleCredentialDialogOpenChange}
        apiKey={currentRow}
        apiBaseUrl={apiBaseUrl}
        tokenKey={resolvedKey}
      />
    </>
  )
}
