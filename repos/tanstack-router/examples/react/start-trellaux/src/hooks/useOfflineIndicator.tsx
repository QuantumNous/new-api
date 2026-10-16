import { onlineManager } from '@tanstack/react-query'
import { useEffect } from 'react'
import toast from 'react-hot-toast'

export function useOfflineIndicator() {
  useEffect(() => {
    return onlineManager.subscribe(() => {
      if (onlineManager.isOnline()) {
        toast.success('online', {
          id: 'ReactQuery',
          duration: 2000,
        })
      } else {
        toast.error('offline', {
          id: 'ReactQuery',
          duration: Infinity,
        })
      }
    })
  }, [])
}
