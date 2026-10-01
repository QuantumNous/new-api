'use client'

import { createContext, use } from 'react'
import type { SlotImplementations } from './types'

export interface SlotContextValue {
  implementations: SlotImplementations
  strict: boolean
}

const SlotContext = createContext<SlotContextValue | null>(null)

/**
 * Hook to access slot implementations from within ClientSlot.
 */
export function useSlotContext(): SlotContextValue | null {
  return use(SlotContext)
}

export interface SlotProviderProps {
  implementations: SlotImplementations
  strict?: boolean
  children?: React.ReactNode
}

/**
 * SlotProvider - makes slot implementations available to ClientSlot components.
 *
 * Must wrap the decoded RSC content so that ClientSlot components can
 * access their slot implementations via React Context.
 */
export function SlotProvider({
  implementations,
  strict,
  children,
}: SlotProviderProps) {
  return (
    <SlotContext value={{ implementations, strict: strict ?? false }}>
      {children}
    </SlotContext>
  )
}
