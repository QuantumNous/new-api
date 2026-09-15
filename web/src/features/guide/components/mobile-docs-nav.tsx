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
import { Menu01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

import type { GuideDocSlug } from '../types'
import { DocsSidebar } from './docs-sidebar'

type MobileDocsNavProps = {
  activeSlug: GuideDocSlug
  query: string
  onQueryChange: (query: string) => void
}

export function MobileDocsNav(props: MobileDocsNavProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='lg:hidden'
            aria-label={t('Open documentation navigation')}
          />
        }
      >
        <HugeiconsIcon icon={Menu01Icon} data-icon='inline-start' />
        {t('Browse docs')}
      </SheetTrigger>
      <SheetContent side='left' className='w-[min(88vw,22rem)]'>
        <SheetHeader className='border-border border-b'>
          <SheetTitle>{t('Documentation')}</SheetTitle>
          <SheetDescription>
            {t('Choose a guide or search all setup instructions.')}
          </SheetDescription>
        </SheetHeader>
        <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain'>
          <DocsSidebar
            activeSlug={props.activeSlug}
            query={props.query}
            onQueryChange={props.onQueryChange}
            onNavigate={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
