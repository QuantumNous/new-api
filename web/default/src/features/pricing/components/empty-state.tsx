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
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

export interface EmptyStateProps {
  searchQuery?: string
  hasActiveFilters: boolean
  onClearFilters: () => void
}

export function EmptyState(props: EmptyStateProps) {
  const { t } = useTranslation()
  const hasSearch = Boolean(props.searchQuery?.trim())

  return (
    <div className='relative flex min-h-[340px] flex-col items-center justify-center overflow-hidden rounded-3xl border border-dashed border-violet-300/35 bg-white/45 px-6 py-12 text-center shadow-[0_24px_80px_rgba(91,33,182,0.08)] backdrop-blur-xl dark:border-violet-300/15 dark:bg-white/[0.025] dark:shadow-[0_24px_90px_rgba(88,28,135,0.18)]'>
      <div
        aria-hidden
        className='absolute inset-x-20 top-10 h-32 rounded-full bg-violet-500/15 blur-3xl dark:bg-violet-400/10'
      />
      <div className='relative mb-4 flex size-16 items-center justify-center rounded-2xl border border-violet-300/35 bg-violet-500/10 text-violet-700 dark:border-violet-300/20 dark:text-violet-100'>
        <Search className='size-8' />
      </div>

      <h3 className='relative mb-1 text-base font-black text-slate-950 dark:text-white'>
        {t('No models found')}
      </h3>

      <p className='relative mb-5 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-white/50'>
        {hasSearch
          ? t(
              'No results for "{{query}}". Try adjusting your search or filters.',
              { query: props.searchQuery }
            )
          : t('No models match your current filters.')}
      </p>

      {(props.hasActiveFilters || hasSearch) && (
        <Button
          variant='outline'
          size='sm'
          onClick={props.onClearFilters}
          className='relative rounded-full border-violet-300/40 bg-white/70 text-slate-800 hover:bg-violet-500/10 dark:border-violet-300/20 dark:bg-white/[0.05] dark:text-white'
        >
          {t('Clear all filters')}
        </Button>
      )}
    </div>
  )
}
