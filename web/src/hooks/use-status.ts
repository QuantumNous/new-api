import { useEffect, useState } from 'react'
import { getStatus } from '@/lib/api'
import type { SystemStatus } from '@/features/auth/types'

export function useStatus() {
  const [status, setStatus] = useState<SystemStatus | null>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem('status')
        return saved ? (JSON.parse(saved) as SystemStatus) : null
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
        setStatus((s ?? null) as SystemStatus | null)
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
