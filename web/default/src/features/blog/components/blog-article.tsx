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

import { useRef } from 'react'
import DOMPurify from 'dompurify'
import { BlogToc } from './blog-toc'

interface BlogArticleProps {
  content: string
}

export function BlogArticle(props: BlogArticleProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const html = DOMPurify.sanitize(props.content, {
    ADD_ATTR: ['target'],
  })

  return (
    <div className='grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_240px]'>
      <div
        ref={contentRef}
        className='blog-content min-w-0'
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <aside className='hidden lg:block'>
        <BlogToc content={html} contentRef={contentRef} />
      </aside>
    </div>
  )
}
