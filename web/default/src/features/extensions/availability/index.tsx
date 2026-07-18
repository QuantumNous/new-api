/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
    70|but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { SectionPageLayout } from '@/components/layout'

import { AvailabilityGroupCard } from './components/availability-group-card'
import { useAvailability } from './hooks/use-availability'

export function AvailabilityMonitorPage() {
  const { t } = useTranslation()
  const query = useAvailability()

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Availability Monitor')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='space-y-4'>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Request health by billing group for the latest 100 consume/error logs. Green bars show latency; red bars are failures. Badge uses overall success rate (≥95% normal, ≥80% warning, below 80% abnormal).'
            )}
          </p>

          {query.isPending ? (
            <div className='flex items-center justify-center gap-2 py-16'>
              <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
              <span className='text-muted-foreground text-sm'>
                {t('Loading...')}
              </span>
            </div>
          ) : null}

          {query.isError ? (
            <Alert variant='destructive'>
              <AlertTitle>{t('Unable to load availability')}</AlertTitle>
              <AlertDescription>
                {query.error instanceof Error
                  ? query.error.message
                  : t('Failed to load availability')}
              </AlertDescription>
            </Alert>
          ) : null}

          {query.data ? (
            <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
              {query.data.groups.map((group) => (
                <AvailabilityGroupCard
                  key={group.group}
                  group={group}
                  refreshHint={t('Refresh every {{seconds}}s', {
                    seconds: query.refreshSeconds,
                  })}
                />
              ))}
            </div>
          ) : null}

          {query.data && query.data.groups.length === 0 ? (
            <p className='text-muted-foreground py-12 text-center text-sm'>
              {t('No billing groups configured.')}
            </p>
          ) : null}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
