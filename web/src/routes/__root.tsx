import { type QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { useAuthStore } from '@/stores/auth-store'
import { getSelf } from '@/lib/api'
import { useSystemConfig } from '@/hooks/use-system-config'
import { Toaster } from '@/components/ui/sonner'
import { NavigationProgress } from '@/components/navigation-progress'
import { GeneralError } from '@/features/errors/general-error'
import { NotFoundError } from '@/features/errors/not-found-error'
import { getSetupStatus } from '@/features/setup/api'

function RootComponent() {
  // Load system configuration (logo, system name, etc.) from backend
  useSystemConfig({ autoLoad: true })

  return (
    <>
      <NavigationProgress />
      <Outlet />
      <Toaster duration={5000} />
      {import.meta.env.MODE === 'development' && (
        <>
          <ReactQueryDevtools buttonPosition='bottom-left' />
          <TanStackRouterDevtools position='bottom-right' />
        </>
      )}
    </>
  )
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  // 应用初始化与路由解析前统一校验会话
  beforeLoad: async ({ location }) => {
    const { auth } = useAuthStore.getState()
    try {
      const res = await getSelf()
      if (res?.success) auth.setUser(res.data)
      else auth.setUser(null)
    } catch {
      auth.setUser(null)
    }

    const pathname = location?.pathname || ''
    if (!pathname.startsWith('/setup')) {
      const status = await getSetupStatus().catch((error) => {
        if (import.meta.env.DEV) {
          console.warn('[root.beforeLoad] setup status check failed', error)
        }
        return null
      })

      if (status?.success && status.data && !status.data.status) {
        throw redirect({ to: '/setup' })
      }
    }
  },
  component: RootComponent,
  notFoundComponent: NotFoundError,
  errorComponent: GeneralError,
})
