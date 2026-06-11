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
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getPublicPathLanguage, localizePublicPath } from '@/lib/public-locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface BlogSearchProps {
  query?: string
  categorySlug?: string
}

export function BlogSearch(props: BlogSearchProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const currentPublicLanguage = getPublicPathLanguage(pathname)
  const [value, setValue] = useState(props.query ?? '')

  const buildSearch = () => {
    const q = value.trim()
    return {
      page: undefined,
      q: q || undefined,
    }
  }

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const search = buildSearch()
    if (props.categorySlug) {
      navigate({
        to: localizePublicPath(
          `/blog/category/${props.categorySlug}`,
          currentPublicLanguage
        ),
        search,
      })
      return
    }
    navigate({ to: localizePublicPath('/blog', currentPublicLanguage), search })
  }

  const clearSearch = () => {
    setValue('')
    if (props.categorySlug) {
      navigate({
        to: localizePublicPath(
          `/blog/category/${props.categorySlug}`,
          currentPublicLanguage
        ),
        search: { page: undefined, q: undefined },
      })
      return
    }
    navigate({
      to: localizePublicPath('/blog', currentPublicLanguage),
      search: { page: undefined, q: undefined },
    })
  }

  return (
    <form
      className='mx-auto mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row'
      onSubmit={submitSearch}
    >
      <div className='relative flex-1'>
        <Search className='text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2' />
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t('Search articles')}
          className='h-11 pl-9'
          type='search'
        />
      </div>
      <Button className='h-11 px-5' type='submit'>
        <Search className='size-4' />
        {t('Search')}
      </Button>
      {props.query && (
        <Button
          className='h-11 px-5'
          type='button'
          variant='outline'
          onClick={clearSearch}
        >
          <X className='size-4' />
          {t('Clear')}
        </Button>
      )}
    </form>
  )
}
