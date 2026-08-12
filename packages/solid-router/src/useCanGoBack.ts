import * as Solid from 'solid-js'
import { useRouter } from './useRouter'

export function useCanGoBack() {
  const router = useRouter()
  return Solid.createMemo(
    () => router.stores.location.get().state.__TSR_index !== 0,
  )
}
