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
import { ViewIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ModelAccessModel } from '@/features/available-models'
import { ModelAccessPreview } from '@/features/available-models/components/model-access-preview'

type ApiKeyModelPreviewDrawerProps = {
  defaultRatio: number | null
  drawerDescription: string
  drawerTitle: string
  emptyDescription: string
  emptyTitle: string
  models: ModelAccessModel[]
  modelRatios: Readonly<Record<string, number>>
  scopeDescription?: string
  scopeKey: string
  scopeTitle: string
  summary: string
  totalCount: number
}

export function ApiKeyModelPreviewDrawerContent(
  props: ApiKeyModelPreviewDrawerProps
) {
  return (
    <>
      <DrawerHeader>
        <DrawerTitle>{props.drawerTitle}</DrawerTitle>
        <DrawerDescription>{props.drawerDescription}</DrawerDescription>
      </DrawerHeader>
      <ScrollArea className='min-h-0 flex-1 px-4 pb-4'>
        <ModelAccessPreview
          defaultRatio={props.defaultRatio}
          modelRatios={props.modelRatios}
          models={props.models}
          totalCount={props.totalCount}
          scopeKey={props.scopeKey}
          scopeTitle={props.scopeTitle}
          scopeDescription={props.scopeDescription}
          summary={props.summary}
          emptyTitle={props.emptyTitle}
          emptyDescription={props.emptyDescription}
        />
      </ScrollArea>
    </>
  )
}

export function ApiKeyModelPreviewDrawer(props: ApiKeyModelPreviewDrawerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <div className='flex flex-col gap-2 lg:hidden'>
      <div className='bg-muted/40 flex items-center justify-between gap-3 rounded-lg border p-3'>
        <div className='min-w-0'>
          <p className='truncate text-sm font-medium'>{props.scopeTitle}</p>
          <p className='text-muted-foreground text-xs'>{props.summary}</p>
          <span className='sr-only'>{props.drawerDescription}</span>
        </div>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            <Button type='button' size='sm' variant='outline'>
              <HugeiconsIcon
                icon={ViewIcon}
                strokeWidth={2}
                data-icon='inline-start'
                aria-hidden='true'
              />
              {t('View models')}
            </Button>
          </DrawerTrigger>
          {open && (
            <DrawerContent className='h-[80vh]'>
              <ApiKeyModelPreviewDrawerContent {...props} />
            </DrawerContent>
          )}
        </Drawer>
      </div>
    </div>
  )
}
