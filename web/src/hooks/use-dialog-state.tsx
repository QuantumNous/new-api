import { useState } from 'react'

/**
 * Custom hook for dialog state management
 * @param initialState Initial dialog state
 * @returns A stateful value, and a function to update it
 * @example const [open, setOpen] = useDialogState<"approve" | "reject">(null)
 */
export default function useDialogState<T extends string | boolean>(
  initialState: T | null = null
) {
  const [open, setOpen] = useState<T | null>(initialState)

  return [open, setOpen] as const
}
