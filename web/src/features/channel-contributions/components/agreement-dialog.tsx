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

import { RichContent } from '@/components/rich-content'
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
import { ScrollArea } from '@/components/ui/scroll-area'

export function ContributionAgreementDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  version: string
  content: string
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='grid max-h-[min(86vh,760px)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 p-0 sm:max-w-2xl'>
        <DialogHeader className='border-b px-4 py-4 sm:px-5'>
          <DialogTitle>{t('Channel Contribution Agreement')}</DialogTitle>
          <DialogDescription>
            {t('Agreement version: {{version}}', { version: props.version })}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className='min-h-0 px-4 py-4 sm:px-5'>
          <RichContent
            content={props.content}
            className='prose-sm max-w-none pb-2'
          />
        </ScrollArea>
        <DialogFooter>
          <DialogClose render={<Button type='button' />}>
            {t('Close')}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
