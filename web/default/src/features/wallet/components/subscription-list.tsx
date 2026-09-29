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
import { ChevronDown } from 'lucide-react'
import { Fragment, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Empty, EmptyDescription, EmptyHeader } from '@/components/ui/empty'
import type { UserSubscriptionRecord } from '@/features/subscriptions/types'
import { cn } from '@/lib/utils'

import { getSubscriptionHistoryPage } from '../lib/subscriptions'

interface SubscriptionListProps {
  current: UserSubscriptionRecord[]
  history: UserSubscriptionRecord[]
  compact?: boolean
  renderSubscription: (record: UserSubscriptionRecord) => ReactNode
}

export function SubscriptionList(props: SubscriptionListProps) {
  const { t } = useTranslation()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [page, setPage] = useState(1)
  const historyPage = getSubscriptionHistoryPage(props.history, page)
  const gridClassName = cn(
    'grid gap-3',
    props.compact ? 'grid-cols-1' : 'lg:grid-cols-2'
  )

  return (
    <div className='space-y-3'>
      {props.current.length > 0 ? (
        <div className={gridClassName}>
          {props.current.map((record) => (
            <Fragment key={record.subscription.id}>
              {props.renderSubscription(record)}
            </Fragment>
          ))}
        </div>
      ) : (
        <Empty className='p-3'>
          <EmptyHeader>
            <EmptyDescription>{t('No current subscriptions')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {props.history.length > 0 && (
        <Collapsible
          open={historyOpen}
          onOpenChange={(open) => {
            setHistoryOpen(open)
            if (open) setPage(1)
          }}
        >
          <CollapsibleTrigger
            render={<Button variant='ghost' size='sm' className='w-full' />}
          >
            {t('Subscription history')} ({props.history.length})
            <ChevronDown
              className={cn('size-4', historyOpen && 'rotate-180')}
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            {historyOpen && (
              <div className='space-y-3 pt-3'>
                <div className={gridClassName}>
                  {historyPage.items.map((record) => (
                    <Fragment key={record.subscription.id}>
                      {props.renderSubscription(record)}
                    </Fragment>
                  ))}
                </div>
                {historyPage.totalPages > 1 && (
                  <nav
                    aria-label={t('Subscription history')}
                    className='flex flex-wrap items-center justify-center gap-2'
                  >
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={historyPage.page === 1}
                      onClick={() => setPage(historyPage.page - 1)}
                    >
                      {t('Previous page')}
                    </Button>
                    <span className='text-muted-foreground text-xs'>
                      {t('Page {{current}} of {{total}}', {
                        current: historyPage.page,
                        total: historyPage.totalPages,
                      })}
                    </span>
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={historyPage.page === historyPage.totalPages}
                      onClick={() => setPage(historyPage.page + 1)}
                    >
                      {t('Next page')}
                    </Button>
                  </nav>
                )}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}
