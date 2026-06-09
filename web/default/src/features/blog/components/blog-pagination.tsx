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
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

interface BlogPaginationProps {
  pageNo: number
  totalPages: number
  query?: string
  categorySlug?: string
}

function buildSearch(page: number, query?: string) {
  return {
    page: page > 1 ? page : undefined,
    q: query || undefined,
  }
}

export function BlogPagination(props: BlogPaginationProps) {
  const { t } = useTranslation()
  if (props.totalPages <= 1) {
    return null
  }

  const prevPage = props.pageNo - 1
  const nextPage = props.pageNo + 1

  const previousLink = props.categorySlug ? (
    <Link
      to='/blog/category/$slug'
      params={{ slug: props.categorySlug }}
      search={buildSearch(prevPage, props.query)}
    />
  ) : (
    <Link to='/blog' search={buildSearch(prevPage, props.query)} />
  )

  const nextLink = props.categorySlug ? (
    <Link
      to='/blog/category/$slug'
      params={{ slug: props.categorySlug }}
      search={buildSearch(nextPage, props.query)}
    />
  ) : (
    <Link to='/blog' search={buildSearch(nextPage, props.query)} />
  )

  return (
    <nav className='mt-14 flex flex-wrap items-center justify-center gap-3'>
      {props.pageNo > 1 && (
        <Button variant='outline' render={previousLink}>
          <ArrowLeft className='size-4' />
          {t('Previous')}
        </Button>
      )}
      <span className='text-muted-foreground text-sm'>
        {t('Page {{page}} of {{total}}', {
          page: props.pageNo,
          total: props.totalPages,
        })}
      </span>
      {props.pageNo < props.totalPages && (
        <Button variant='outline' render={nextLink}>
          {t('Next')}
          <ArrowRight className='size-4' />
        </Button>
      )}
    </nav>
  )
}
