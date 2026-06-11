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

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface TocItem {
  id: string
  text: string
  level: number
}

interface BlogTocProps {
  content: string
  contentRef: React.RefObject<HTMLDivElement | null>
}

export function BlogToc(props: BlogTocProps) {
  const { t } = useTranslation()
  const [items, setItems] = useState<TocItem[]>([])
  const [activeId, setActiveId] = useState('')
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const el = props.contentRef.current
    if (!el) {
      return
    }
    const headings = Array.from(el.querySelectorAll('h2, h3')) as HTMLElement[]
    const toc = headings.map((heading, index) => {
      if (!heading.id) {
        heading.id = `heading-${index}`
      }
      return {
        id: heading.id,
        text: heading.innerText,
        level: Number(heading.tagName[1]),
      }
    })
    setItems(toc)

    observerRef.current?.disconnect()
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: '-96px 0px -60% 0px' }
    )
    headings.forEach((heading) => observerRef.current?.observe(heading))
    return () => observerRef.current?.disconnect()
  }, [props.content, props.contentRef])

  if (items.length < 2) {
    return null
  }

  return (
    <nav className='sticky top-24 text-sm'>
      <p className='text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase'>
        {t('On this page')}
      </p>
      <ul className='space-y-1.5'>
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={cn(
                'block leading-snug transition-colors',
                item.level === 3 && 'pl-3',
                activeId === item.id
                  ? 'text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={(event) => {
                event.preventDefault()
                document
                  .getElementById(item.id)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
