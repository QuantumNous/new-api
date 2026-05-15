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
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { ApiKey } from '@/features/keys/types'

type ChatKeySelectSheetProps = {
  open: boolean
  apiKeys: ApiKey[]
  pendingKeyId?: number | null
  onOpenChange: (open: boolean) => void
  onSelect: (apiKey: ApiKey) => void
}

export function ChatKeySelectSheet({
  open,
  apiKeys,
  pendingKeyId,
  onOpenChange,
  onSelect,
}: ChatKeySelectSheetProps) {
  const { t } = useTranslation()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='w-full sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>{t('Select API key')}</SheetTitle>
        </SheetHeader>
        <div className='flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4'>
          {apiKeys.map((apiKey) => {
            const pending = pendingKeyId === apiKey.id

            return (
              <Button
                key={apiKey.id}
                type='button'
                variant='outline'
                className={cn(
                  'h-auto justify-start rounded-md p-3 text-left',
                  pending && 'pointer-events-none opacity-75'
                )}
                disabled={Boolean(pendingKeyId)}
                onClick={() => onSelect(apiKey)}
              >
                <span className='flex min-w-0 flex-1 flex-col gap-1'>
                  <span className='text-foreground truncate font-medium'>
                    {apiKey.name || t('API Key')}
                  </span>
                  <span className='text-muted-foreground truncate font-mono text-xs'>
                    {apiKey.key}
                  </span>
                  <span className='text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs'>
                    {apiKey.group ? (
                      <span>
                        {t('Group')}: {apiKey.group}
                      </span>
                    ) : null}
                    <span>
                      {t('Remaining:')}{' '}
                      {apiKey.unlimited_quota
                        ? t('Unlimited')
                        : formatQuota(apiKey.remain_quota)}
                    </span>
                  </span>
                </span>
                {pending ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
              </Button>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}
