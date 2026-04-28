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
