import { useCallback } from 'react'
import { toast } from 'sonner'
import { MESSAGE_ACTION_LABELS } from '../constants'

/**
 * Hook to guard message actions when generation is in progress
 * Provides a wrapper that checks if generation is active before executing
 */
export function useMessageActionGuard(isGenerating: boolean) {
  const guardAction = useCallback(
    (action: () => void) => {
      return () => {
        if (isGenerating) {
          toast.warning(MESSAGE_ACTION_LABELS.WAIT_GENERATION)
          return
        }
        action()
      }
    },
    [isGenerating]
  )

  return { guardAction }
}
