'use client'

import { useSlotContext } from './SlotContext'

export interface ClientSlotProps {
  slot: string
  args: Array<unknown>
}

export function ClientSlot({ slot, args }: ClientSlotProps) {
  const ctx = useSlotContext()

  if (!ctx) {
    throw new Error('ClientSlot must be rendered within SlotProvider')
  }

  const impl = ctx.implementations[slot]

  // No implementation provided
  if (impl === undefined) {
    if (ctx.strict) {
      throw new Error(`Missing slot implementation for "${slot}"`)
    }
    return null
  }

  // For children slot or any non-function value, render directly
  if (typeof impl !== 'function') {
    return <>{impl}</>
  }

  // Render function with args
  return <>{impl(...args)}</>
}
