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
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from '@/lib/sonner'
import { searchUsers } from '@/features/users/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ComboboxInput } from '@/components/ui/combobox-input'
import { transferApiKey } from '../../api'
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../constants'
import { type ApiKey } from '../../types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: ApiKey | null
  onSuccess: () => void
}

export function TransferDialog(props: Props) {
  const { t } = useTranslation()
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [isTransferring, setIsTransferring] = useState(false)

  const { data: usersData } = useQuery({
    queryKey: ['search-users-transfer'],
    queryFn: () => searchUsers({ page_size: 50 }),
    enabled: props.open,
  })

  const userOptions = (usersData?.data?.items ?? []).map((u) => ({
    value: String(u.id),
    label: u.display_name
      ? `${u.display_name} (${u.username})`
      : u.username,
  }))

  const handleTransfer = async () => {
    if (!props.currentRow || !selectedUserId) return

    setIsTransferring(true)
    try {
      const result = await transferApiKey(props.currentRow.id, selectedUserId)
      if (result.success) {
        toast.success(t(SUCCESS_MESSAGES.API_KEY_TRANSFERRED))
        props.onOpenChange(false)
        props.onSuccess()
      } else {
        toast.error(result.message || t(ERROR_MESSAGES.TRANSFER_FAILED))
      }
    } catch {
      toast.error(t(ERROR_MESSAGES.UNEXPECTED))
    } finally {
      setIsTransferring(false)
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('Transfer Key')}</DialogTitle>
          <DialogDescription>
            {t('Transfer this API key to another user. Associated logs will also be migrated.')}
          </DialogDescription>
        </DialogHeader>

        <ComboboxInput
          options={userOptions}
          value={selectedUserId ? String(selectedUserId) : ''}
          onValueChange={(v) => {
            setSelectedUserId(v ? Number(v) : null)
          }}
          placeholder={t('Select a user...')}
          emptyText={t('No users found')}
        />

        <DialogFooter>
          <Button variant='outline' onClick={() => props.onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!selectedUserId || isTransferring}
          >
            {isTransferring ? t('Transferring...') : t('Transfer')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
