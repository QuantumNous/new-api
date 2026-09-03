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
import { Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

import { SUCCESS_MESSAGES } from '../constants'
import { useRedemptions } from './redemptions-provider'

export function RedemptionsCreatedDialog() {
  const { t } = useTranslation()
  const { open, setOpen, createdCodes } = useRedemptions()
  const { copyToClipboard } = useCopyToClipboard({ notify: false })
  const count = createdCodes.length

  const handleCopyAll = async () => {
    const copied = await copyToClipboard(createdCodes.join('\n'))
    if (copied) {
      toast.success(t('Copied {{count}} code(s)', { count }))
      return
    }
    toast.error(t('Failed to copy to clipboard'))
  }

  let title = t(SUCCESS_MESSAGES.REDEMPTION_CREATED)
  if (count > 1) {
    title = t('Successfully created {{count}} redemption codes', { count })
  }

  return (
    <Dialog
      open={open === 'created'}
      onOpenChange={(isOpen) => !isOpen && setOpen(null)}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {t(
              'Copy the codes below now, or find them anytime in the redemption code list.'
            )}
          </DialogDescription>
        </DialogHeader>

        <ul className='max-h-[50vh] space-y-1 overflow-y-auto rounded-md border p-1'>
          {createdCodes.map((code, index) => (
            <li
              key={code}
              className='hover:bg-muted/50 flex items-center gap-1 rounded-sm px-2 py-1'
            >
              <span className='min-w-0 flex-1 font-mono text-xs break-all'>
                {code}
              </span>
              <CopyButton
                value={code}
                className='size-7'
                iconClassName='size-3.5'
                tooltip={t('Copy code')}
                aria-label={t('Copy redemption code {{index}}', {
                  index: index + 1,
                })}
              />
            </li>
          ))}
        </ul>

        <DialogFooter>
          <DialogClose render={<Button variant='outline' />}>
            {t('Close')}
          </DialogClose>
          <Button onClick={handleCopyAll}>
            <Copy />
            {t('Copy All')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
