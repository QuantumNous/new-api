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

import { Dialog } from '@/components/dialog'
import { RichContent } from '@/components/rich-content'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

import { useNoticePopup } from '../hooks'

/**
 * Homepage notice dialog. Auto-opens on the Home route when a non-empty notice
 * exists and has not been dismissed for the day. Mounts once; renders through a
 * portal so it is invisible until opened.
 */
export function HomeNoticeDialog() {
  const { t } = useTranslation()
  const { notice, open, onOpenChange, closeForToday } = useNoticePopup()

  if (!notice) return null

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('Notice')}
      contentClassName='sm:max-w-lg'
      footer={
        <>
          <Button variant='outline' onClick={closeForToday}>
            {t('Close Today')}
          </Button>
          <Button onClick={() => onOpenChange(false)}>{t('Close')}</Button>
        </>
      }
    >
      <ScrollArea className='max-h-[min(58vh,520px)] pr-4'>
        <RichContent breaks content={notice} />
      </ScrollArea>
    </Dialog>
  )
}
