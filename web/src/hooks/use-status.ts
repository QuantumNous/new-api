import { useEffect, useState } from 'react'
import { getStatus } from '@/features/auth/api'

export function useStatus() {
  const [status, setStatus] = useState<any>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem('status')
        return saved ? JSON.parse(saved) : null
      }
    } catch {}
    return null
  })
  const [loading, setLoading] = useState(!status)

  useEffect(() => {
    let mounted = true
    getStatus()
      .then((s) => {
        if (!mounted) return
        setStatus(s)
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('status', JSON.stringify(s))
          }
        } catch {}
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  return { status, loading }
}
