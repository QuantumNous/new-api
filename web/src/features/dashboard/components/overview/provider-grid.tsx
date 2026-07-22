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
import { Link } from '@tanstack/react-router'
import { ArrowRight, MoreHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { getLobeIcon } from '@/lib/lobe-icon'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEnabledProviders } from '../../hooks/use-enabled-providers'

/**
 * Grid of model providers available through the gateway.
 * Falls back to a default set of recognized brands when the user has no
 * model list yet (e.g. before the first request).
 */
export function ProviderGrid() {
  const { t } = useTranslation()
  const { providers, totalModels } = useEnabledProviders()

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between gap-3'>
        <div className='flex items-baseline gap-2'>
          <CardTitle className='text-base sm:text-lg'>
            {t('Model Providers')}
          </CardTitle>
          {totalModels > 0 && (
            <span className='text-muted-foreground text-xs'>
              {t('Supports {{count}}+ models', {
                count: Math.max(20, totalModels),
              })}
            </span>
          )}
        </div>
        <Link
          to='/pricing'
          className='inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-blue)] hover:underline'
        >
          {t('View all models')}
          <ArrowRight className='size-3' aria-hidden />
        </Link>
      </CardHeader>
      <CardContent>
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'>
          {providers.map((provider) => (
            <ProviderTile key={provider.id} provider={provider} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ProviderTile({
  provider,
}: {
  provider: ReturnType<typeof useEnabledProviders>['providers'][number]
}) {
  const { t } = useTranslation()
  const isMore = provider.id === 'more'

  const label = isMore ? t('More models') : provider.label

  const inner = (
    <div
      className={cn(
        'group relative flex h-24 flex-col items-center justify-center gap-2 rounded-xl border bg-background/60 px-3 py-2 transition',
        'hover:-translate-y-0.5 hover:bg-background hover:shadow-[var(--shadow-soft)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/40'
      )}
    >
      <div className='flex size-10 items-center justify-center'>
        {isMore ? (
          <MoreHorizontal className='size-6 text-muted-foreground' aria-hidden />
        ) : (
          getLobeIcon(provider.icon, 36)
        )}
      </div>
      <div className='text-sm font-medium text-foreground'>
        {label}
      </div>
    </div>
  )

  if (isMore) {
    return <Link to='/pricing'>{inner}</Link>
  }

  return inner
}
