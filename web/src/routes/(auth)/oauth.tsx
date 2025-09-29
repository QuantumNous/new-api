import { useEffect } from 'react'
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { getSelf, wechatLoginByCode } from '@/features/auth/api'

export const Route = createFileRoute('/(auth)/oauth')({
  component: () => {
    const navigate = useNavigate()
    const search = useSearch({ from: '/(auth)/oauth' }) as {
      redirect?: string
      provider?: 'github' | 'oidc' | 'linuxdo' | 'telegram' | 'wechat'
      code?: string
      state?: string
    }

    useEffect(() => {
      ;(async () => {
        try {
          // Special case: WeChat flow can arrive here with code
          if (search?.provider === 'wechat' && search.code) {
            await wechatLoginByCode(search.code)
          }
          const res = await getSelf()
          if (res?.success) {
            useAuthStore.getState().auth.setUser(res.data as any)
            const target = search?.redirect || '/'
            navigate({ to: target, replace: true })
            return
          }
        } catch {}
        toast.error('OAuth failed')
        navigate({ to: '/sign-in', replace: true })
      })()
    }, [navigate, search])

    return null
  },
})
