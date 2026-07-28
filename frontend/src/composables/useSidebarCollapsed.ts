import { useStorage } from '@vueuse/core'

const SIDEBAR_COLLAPSED_KEY = 'ren2hub_sidebar_collapsed'

/**
 * Console sidebar collapsed state. useStorage broadcasts same-document
 * changes, so every subscriber (the sidebar itself, overlays that align to
 * its width) stays in sync without stringly-typed key coupling.
 */
export function useSidebarCollapsed() {
  return useStorage<boolean>(SIDEBAR_COLLAPSED_KEY, false)
}
