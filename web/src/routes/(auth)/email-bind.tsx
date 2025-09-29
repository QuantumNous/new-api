import { useEffect } from 'react'
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { toast } from 'sonner'
import { bindEmail } from '@/features/auth/api'

export const Route = createFileRoute('/(auth)/email-bind')({
  component: () => {
    const navigate = useNavigate()
    const search = useSearch({ from: '/(auth)/email-bind' }) as {
      email?: string
      code?: string
    }

    useEffect(() => {
      ;(async () => {
        if (!search?.email || !search?.code) {
          toast.error('Missing parameters')
          navigate({ to: '/_authenticated/settings/account', replace: true })
          return
        }
        try {
          const res = await bindEmail(search.email, search.code)
          if (res?.success) {
            toast.success('Email bound successfully')
          } else {
            toast.error(res?.message || 'Email bind failed')
          }
        } catch {
          toast.error('Email bind failed')
        } finally {
          navigate({ to: '/_authenticated/settings/account', replace: true })
        }
      })()
    }, [navigate, search])

    return null
  },
})
