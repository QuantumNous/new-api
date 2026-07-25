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
  Plus,
  MoreHorizontal,
  RefreshCw,
  List,
  Building2,
  AlertCircle,
  PowerOff,
  Power,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { useModels } from './models-provider'
import {
  handleBatchDisableModelsNoChannels,
  handleBatchEnableModelsWithChannels,
} from '../lib/model-actions'

type ConfirmAction = 'disable-no-channels' | 'enable-with-channels'

export function ModelsPrimaryButtons() {
  const { t } = useTranslation()
  const { setOpen, setCurrentRow } = useModels()
  const queryClient = useQueryClient()
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null
  )
  const [confirming, setConfirming] = useState(false)

  const handleCreateModel = () => {
    setCurrentRow(null)
    setOpen('create-model')
  }

  const handleMissingModels = () => {
    setOpen('missing-models')
  }

  const handleSync = () => {
    setOpen('sync-wizard')
  }

  const handlePrefillGroups = () => {
    setOpen('prefill-groups')
  }

  const handleManageVendors = () => {
    setOpen('create-vendor') // Will be a separate vendors management dialog
  }

  const confirmDialog =
    confirmAction === 'disable-no-channels'
      ? {
          title: t('Disable Models with No Channels?'),
          description: t(
            'This will disable all currently enabled models that have no available channels. Continue?'
          ),
          confirmLabel: t('Disable'),
          variant: 'destructive' as const,
        }
      : confirmAction === 'enable-with-channels'
        ? {
            title: t('Enable Models with Recovered Channels?'),
            description: t(
              'This will enable disabled models that currently have available channels. Continue?'
            ),
            confirmLabel: t('Enable'),
            variant: 'default' as const,
          }
        : null

  const handleConfirm = async () => {
    if (!confirmAction || confirming) return
    setConfirming(true)
    try {
      if (confirmAction === 'disable-no-channels') {
        await handleBatchDisableModelsNoChannels(queryClient)
      } else {
        await handleBatchEnableModelsWithChannels(queryClient)
      }
      setConfirmAction(null)
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className='flex items-center gap-2'>
      {/* Create Model */}
      <Button onClick={handleCreateModel} size='sm'>
        <Plus className='h-4 w-4' />
        {t('Add Model')}
      </Button>

      {/* More Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant='outline' size='sm' />}>
          <MoreHorizontal className='h-4 w-4' />
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-64'>
          <DropdownMenuItem onClick={handleMissingModels}>
            {t('Missing Models')}
            <DropdownMenuShortcut>
              <AlertCircle className='h-4 w-4' />
            </DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleSync}>
            {t('Sync Upstream')}
            <DropdownMenuShortcut>
              <RefreshCw className='h-4 w-4' />
            </DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handlePrefillGroups}>
            {t('Prefill Groups')}
            <DropdownMenuShortcut>
              <List className='h-4 w-4' />
            </DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleManageVendors}>
            {t('Manage Vendors')}
            <DropdownMenuShortcut>
              <Building2 className='h-4 w-4' />
            </DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setConfirmAction('disable-no-channels')}
          >
            {t('Batch Disable Models with No Channels')}
            <DropdownMenuShortcut>
              <PowerOff className='h-4 w-4' />
            </DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setConfirmAction('enable-with-channels')}
          >
            {t('Batch Enable Models with Recovered Channels')}
            <DropdownMenuShortcut>
              <Power className='h-4 w-4' />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open && !confirming) setConfirmAction(null)
        }}
        title={confirmDialog?.title ?? ''}
        description={confirmDialog?.description}
        contentHeight='auto'
        footer={
          <>
            <Button
              variant='outline'
              disabled={confirming}
              onClick={() => setConfirmAction(null)}
            >
              {t('Cancel')}
            </Button>
            <Button
              variant={confirmDialog?.variant ?? 'default'}
              disabled={confirming}
              onClick={handleConfirm}
            >
              {confirmDialog?.confirmLabel ?? t('Confirm')}
            </Button>
          </>
        }
      >
        {' '}
      </Dialog>
    </div>
  )
}
