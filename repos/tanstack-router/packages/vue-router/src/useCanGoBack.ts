import { useStore } from '@tanstack/vue-store'
import { useRouter } from './useRouter'

export function useCanGoBack() {
  const router = useRouter()
  return useStore(
    router.stores.location,
    (location) => location.state.__TSR_index !== 0,
  )
}
