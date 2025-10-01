import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { getSelf } from '@/lib/api'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const { auth } = useAuthStore.getState()

    // 如果没有用户信息，尝试从 session 获取
    // 注意：根路由已经在启动时验证过，这里主要处理直接访问受保护路由的情况
    if (!auth.user) {
      try {
        const res = await getSelf()
        if (!res?.success) {
          throw new Error('unauthorized')
        }
        auth.setUser(res.data)
      } catch {
        // Session 无效或未登录，重定向到登录页
        // 保存当前 URL 以便登录后返回
        throw redirect({
          to: '/sign-in',
          search: { redirect: location.href },
        })
      }
    }
  },
  component: AuthenticatedLayout,
})
