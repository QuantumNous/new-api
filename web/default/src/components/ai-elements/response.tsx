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
'use client'

import { memo, useMemo } from 'react'
import { getMarkdown, parseMarkdownToStructure } from 'stream-markdown-parser'

import { cn } from '@/lib/utils'

import { getMarkdownContent, parseResponseContent } from './response-content'
import { renderChildren, renderFootnotes } from './response-renderer'
import type { ResponseProps } from './response-types'

const markdown = getMarkdown('new-api-response')

export const Response = memo((props: ResponseProps) => {
  const content = getMarkdownContent(props.children)
  const nodes = useMemo(
    () =>
      parseMarkdownToStructure(content, markdown, {
        final: props.final ?? true,
        validateLink: markdown.options.validateLink,
      }),
    [content, props.final]
  )
  const parsedContent = useMemo(() => parseResponseContent(nodes), [nodes])
  const renderedContent =
    parsedContent.bodyNodes.length > 0
      ? renderChildren(parsedContent.bodyNodes)
      : content
  const footnotes = renderFootnotes(parsedContent.footnotes)

  return (
    <div
      className={cn(
        'size-full min-w-0 text-pretty [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        props.className
      )}
    >
      {renderedContent}
      {footnotes}
    </div>
  )
})

Response.displayName = 'Response'
