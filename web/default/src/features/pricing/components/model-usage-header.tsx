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
import { Boxes } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SearchBar } from './search-bar'

type ModelUsageHeaderProps = {
  searchInput: string
  onSearchInputChange: (value: string) => void
  onClearSearch: () => void
  modelCount: number
}

export function ModelUsageHeader(props: ModelUsageHeaderProps) {
  const { t } = useTranslation()

  return (
    <section className='mb-4 rounded-3xl border border-violet-500/14 bg-white/72 p-5 shadow-[0_18px_64px_-56px_rgba(91,33,182,0.62)] backdrop-blur-sm sm:p-6 dark:border-violet-300/12 dark:bg-white/[0.035]'>
      <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
        <div className='min-w-0'>
          <h3 className='text-foreground inline-flex items-center gap-3 text-xl font-bold tracking-tight sm:text-2xl'>
            <span className='bg-muted/70 border-border text-foreground/80 inline-flex size-9 shrink-0 items-center justify-center rounded-full border'>
              <Boxes className='size-5' aria-hidden='true' />
            </span>
            {t('This site currently has {{count}} models enabled', {
              count: props.modelCount,
            })}
          </h3>
        </div>

        <SearchBar
          value={props.searchInput}
          onChange={props.onSearchInputChange}
          onClear={props.onClearSearch}
          placeholder={t('Search model name, provider, endpoint, or tag...')}
          className='w-full lg:max-w-xl'
        />
      </div>
    </section>
  )
}
