import { useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'

export function useCopyToClipboard() {
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const copyToClipboard = useCallback(
    async (text: string): Promise<boolean> => {
      if (!navigator?.clipboard) {
        console.warn('Clipboard not supported')
        toast.error('Clipboard not supported in your browser')
        return false
      }

      try {
        await navigator.clipboard.writeText(text)
        setCopiedText(text)
        toast.success('Copied to clipboard')

        // Clear previous timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }

        // Auto-reset after 2 seconds
        timeoutRef.current = setTimeout(() => {
          setCopiedText(null)
        }, 2000)

        return true
      } catch (error) {
        console.warn('Copy failed', error)
        toast.error('Failed to copy to clipboard')
        setCopiedText(null)
        return false
      }
    },
    []
  )

  return { copiedText, copyToClipboard }
}
