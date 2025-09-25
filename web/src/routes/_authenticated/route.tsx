import { useEffect } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { getStoredUser } from '@/lib/auth'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const user = getStoredUser()
    if (!user) {
      throw redirect({ to: '/sign-in', search: { redirect: location.href } })
    }
  },
  component: () => {
    const { auth } = useAuthStore()
    useEffect(() => {
      auth.fetchSelf().catch(() => {})
    }, [])
    return <AuthenticatedLayout />
  },
})
