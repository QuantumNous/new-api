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
import DOMPurify from 'dompurify'
import { useMemo } from 'react'

import { cn } from '@/lib/utils'

interface HtmlContentProps {
  content: string
  className?: string
}

export function HtmlContent(props: HtmlContentProps) {
  // 放宽 DOMPurify 限制，允许管理员设置的内联样式、class 和 id，避免自定义 HTML 样式丢失
  const html = useMemo(
    () =>
      DOMPurify.sanitize(props.content, {
        ADD_ATTR: ['class', 'style', 'id', 'target', 'rel'],
        ADD_TAGS: ['style', 'iframe', 'video', 'audio', 'source'],
        FORCE_BODY: true,
      }),
    [props.content]
  )

  return (
    <div
      className={cn(
        'prose prose-neutral dark:prose-invert max-w-none',
        props.className
      )}
      // eslint-disable-next-line react/no-danger -- html is sanitized above
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
