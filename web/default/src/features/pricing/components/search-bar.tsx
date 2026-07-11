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
import { Search, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/design-system/button'
import { Input } from '@/components/design-system/input'
import { cn } from '@/lib/utils'

export interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onClear: () => void
  placeholder?: string
  className?: string
}

export function SearchBar(props: SearchBarProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className={cn('relative', props.className)}>
      <Search
        aria-hidden='true'
        className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2'
      />
      <Input
        ref={inputRef}
        type='search'
        placeholder={props.placeholder || t('Search models...')}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className='bg-background w-full pr-14 pl-8 [&::-webkit-search-cancel-button]:hidden'
        aria-label={t('Search models')}
      />
      <div className='absolute top-1/2 right-1 flex -translate-y-1/2 items-center'>
        {props.value ? (
          <Button
            variant='ghost'
            size='icon-xs'
            onClick={props.onClear}
            className='text-muted-foreground hover:text-foreground'
            aria-label={t('Clear search')}
          >
            <X aria-hidden='true' className='size-3.5' />
          </Button>
        ) : (
          <kbd className='bg-muted text-muted-foreground pointer-events-none hidden rounded-md border px-1.5 py-0.5 font-mono text-xs sm:inline-block'>
            Ctrl K
          </kbd>
        )}
      </div>
    </div>
  )
}
