import { useState, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { copyToClipboard as copyToClipboardUtil } from '@/lib/copy-to-clipboard'

type UseCopyToClipboardOptions = {
  /** Whether to show a global toast notification (default: true) */
  notify?: boolean
  /** Success message (default: 'Copied to clipboard') */
  successMessage?: string
  /** Error message (default: 'Failed to copy to clipboard') */
  errorMessage?: string
  /** Time to automatically reset copiedText (milliseconds, default: 2000) */
  resetAfterMs?: number
}

export function useCopyToClipboard(options?: UseCopyToClipboardOptions) {
  const {
    notify = true,
    successMessage = 'Copied to clipboard',
    errorMessage = 'Failed to copy to clipboard',
    resetAfterMs = 2000,
  } = options || {}

  const [copiedText, setCopiedText] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const copyToClipboard = useCallback(
    async (text: string): Promise<boolean> => {
      const success = await copyToClipboardUtil(text)

      if (success) {
        setCopiedText(text)
        if (notify) {
          toast.success(successMessage)
        }

        // Clear previous timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }

        // Auto-reset after 2 seconds
        timeoutRef.current = setTimeout(() => {
          setCopiedText(null)
        }, resetAfterMs)

        return true
      } else {
        console.warn('All copy methods failed')
        if (notify) {
          toast.error(errorMessage)
        }
        setCopiedText(null)
        return false
      }
    },
    [notify, successMessage, errorMessage, resetAfterMs]
  )

  return { copiedText, copyToClipboard }
}
