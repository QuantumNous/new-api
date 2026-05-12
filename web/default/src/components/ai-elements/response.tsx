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

import { type ComponentProps, memo } from 'react'
import { Streamdown } from 'streamdown'
import { cn } from '@/lib/utils'

type ResponseProps = ComponentProps<typeof Streamdown>

export const Response = memo(
  ({ className, children, ...props }: ResponseProps) => {
    const stripCustomTags = (input: unknown): unknown => {
      if (typeof input !== 'string') return input
      return (
        input
          // Remove known AI custom wrapper tags but keep inner content
          .replace(
            /<\/?(conversation|conversationcontent|reasoning|reasoningcontent|reasoningtrigger|sources|sourcescontent|sourcestrigger|branch|branchmessages|branchnext|branchpage|branchprevious|branchselector|message|messagecontent)\b[^>]*>/gi,
            ''
          )
          // Remove any stray <think> tags if they still appear
          .replace(/<\/?think\b[^>]*>/gi, '')
      )
    }

    const safeChildren = stripCustomTags(children) as string

    return (
      <Streamdown
        className={cn(
          'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
          className
        )}
        {...props}
      >
        {safeChildren}
      </Streamdown>
    )
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
)

Response.displayName = 'Response'
