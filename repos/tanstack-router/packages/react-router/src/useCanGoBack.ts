import { useStore } from '@tanstack/react-store'
import { isServer } from '@tanstack/router-core/isServer'
import { useRouter } from './useRouter'

export function useCanGoBack() {
  const router = useRouter()

  if (isServer ?? router.isServer) {
    return router.stores.location.get().state.__TSR_index !== 0
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks -- condition is static
  return useStore(
    router.stores.location,
    (location) => location.state.__TSR_index !== 0,
  )
}
