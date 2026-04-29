'use client'

import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@/lib/utils'

const requiredMarkerPattern = /\s\*$/

function renderRequiredMarker(text: string, key?: React.Key) {
  if (!requiredMarkerPattern.test(text)) {
    return text
  }

  return (
    <span key={key}>
      {text.slice(0, -1)}
      <span className='text-destructive'>*</span>
    </span>
  )
}

function renderLabelChildren(children: React.ReactNode) {
  const childArray = React.Children.toArray(children)

  if (childArray.length === 0) {
    return children
  }

  if (
    childArray.every(
      (child) => typeof child === 'string' || typeof child === 'number'
    )
  ) {
    return renderRequiredMarker(childArray.join(''))
  }

  return childArray.map((child, index) => {
    if (typeof child === 'string' || typeof child === 'number') {
      return renderRequiredMarker(String(child), index)
    }

    return child
  })
}

function Label({
  className,
  children,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot='label'
      className={cn(
        'flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className
      )}
      {...props}
    >
      {renderLabelChildren(children)}
    </LabelPrimitive.Root>
  )
}

export { Label }
