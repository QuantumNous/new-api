import { useEffect } from 'react'
import {
  createFileRoute,
  useNavigate,
  useParams,
  useSearch,
} from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@/lib/api'
import { getSelf } from '@/features/auth/api'

export const Route = createFileRoute('/oauth/$provider')({
  component: () => {
    const navigate = useNavigate()
    const { provider } = useParams({ from: '/oauth/$provider' }) as {
      provider: string
    }
    const search = useSearch({ from: '/oauth/$provider' }) as {
      code?: string
      state?: string
      redirect?: string
    }

    useEffect(() => {
      ;(async () => {
        if (!search?.code) {
          toast.error('Missing code')
          navigate({ to: '/sign-in', replace: true })
          return
        }
        try {
          const res = await api.get(`/api/oauth/${provider}`, {
            params: { code: search.code, state: search.state },
          })
          if (res?.data?.success) {
            const { message } = res.data
            // Check if this is a bind operation
            if (message === 'bind') {
              toast.success('Binding successful!')
              const href = '/_authenticated/settings/account'
              if (typeof window !== 'undefined') window.location.replace(href)
              return
            }
            // Otherwise it's a login, fetch self and go home
            const self = await getSelf()
            if (self?.success) {
              useAuthStore.getState().auth.setUser(self.data as any)
              try {
                if (typeof window !== 'undefined' && (self as any).data?.id) {
                  window.localStorage.setItem(
                    'uid',
                    String((self as any).data.id)
                  )
                }
              } catch {}
            }
            const to = search?.redirect || '/'
            navigate({ to, replace: true })
            toast.success('Signed in successfully!')
            return
          }
        } catch {}
        toast.error('OAuth failed')
        navigate({ to: '/sign-in', replace: true })
      })()
    }, [navigate, provider, search])

    return null
  },
})
