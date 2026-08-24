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
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { ModelAccessModel } from '@/features/available-models'
import { ModelAccessPreview } from '@/features/available-models/components/model-access-preview'

type ApiKeyModelScopeSheetProps = {
  apiKeyName: string
  defaultRatio: number | null
  models: ModelAccessModel[]
  modelRatios: Readonly<Record<string, number>>
  totalCount: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ApiKeyModelScopeSheetContentProps = Omit<
  ApiKeyModelScopeSheetProps,
  'open' | 'onOpenChange'
>

export function ApiKeyModelScopeSheetContent(
  props: ApiKeyModelScopeSheetContentProps
) {
  const { t } = useTranslation()

  return (
    <>
      <SheetHeader>
        <SheetTitle>{t('Callable model scope')}</SheetTitle>
        <SheetDescription>
          {props.apiKeyName} ·{' '}
          {t('{{count}} callable models', { count: props.models.length })}
        </SheetDescription>
      </SheetHeader>
      <ScrollArea className='min-h-0 flex-1 px-4 pb-4'>
        <ModelAccessPreview
          defaultRatio={props.defaultRatio}
          modelRatios={props.modelRatios}
          models={props.models}
          totalCount={props.totalCount}
          scopeTitle={props.apiKeyName}
        />
      </ScrollArea>
    </>
  )
}

export function ApiKeyModelScopeSheet(props: ApiKeyModelScopeSheetProps) {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className='w-full sm:max-w-2xl'>
        <ApiKeyModelScopeSheetContent {...props} />
      </SheetContent>
    </Sheet>
  )
}
