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
import { Link, useRouterState } from '@tanstack/react-router'
import { CalendarDays } from 'lucide-react'
import { getPublicPathLanguage, localizePublicPath } from '@/lib/public-locale'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { formatBlogDate } from '../lib/format'
import { buildBlogPostPath } from '../lib/routes'
import type { BlogPost } from '../types'

interface BlogCardProps {
  post: BlogPost
  compact?: boolean
}

export function BlogCard(props: BlogCardProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const currentPublicLanguage = getPublicPathLanguage(pathname)
  const date = formatBlogDate(props.post.date, 'short')

  return (
    <Link
      to={localizePublicPath(
        buildBlogPostPath(props.post.slug),
        currentPublicLanguage
      )}
      className='border-border/70 bg-card group flex min-h-full flex-col overflow-hidden rounded-lg border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg'
    >
      {props.post.cover ? (
        <div className='bg-muted aspect-[16/9] overflow-hidden'>
          <img
            src={props.post.cover}
            alt={props.post.title}
            loading='lazy'
            decoding='async'
            className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]'
          />
        </div>
      ) : (
        <div className='from-primary/15 via-muted to-secondary/20 aspect-[16/9] bg-linear-to-br' />
      )}
      <div className={cn('flex flex-1 flex-col p-5', props.compact && 'p-4')}>
        {props.post.categoryName && (
          <Badge variant='outline' className='mb-3 max-w-fit'>
            {props.post.categoryName}
          </Badge>
        )}
        <h2
          className={cn(
            'text-foreground group-hover:text-primary line-clamp-2 font-semibold transition-colors',
            props.compact ? 'text-sm leading-snug' : 'text-base leading-snug'
          )}
        >
          {props.post.title}
        </h2>
        {props.post.summary && !props.compact && (
          <p className='text-muted-foreground mt-3 line-clamp-3 flex-1 text-sm leading-6'>
            {props.post.summary}
          </p>
        )}
        <div className='text-muted-foreground mt-5 flex flex-wrap items-center gap-2 text-xs'>
          {date && (
            <span className='inline-flex items-center gap-1.5'>
              <CalendarDays className='size-3.5' />
              {date}
            </span>
          )}
          {props.post.author && <span>{props.post.author}</span>}
        </div>
      </div>
    </Link>
  )
}
