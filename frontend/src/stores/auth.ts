import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { clearDemoUser, readDemoUser, writeDemoUser } from '@/api/demoStorage'
import { isMockApi } from '@/api/client'
import { setUnauthorizedHandler } from '@/api/createClient'
import { ApiError } from '@/api/types'
import type { UserInfo, UserProfilePatch } from '@/types/auth'

async function getAuthApi() {
  const { authApi } = await import('@/api/auth')
  return authApi
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserInfo | null>(readDemoUser())
  const checked = ref(false)

  const isAuthenticated = computed(() => Boolean(user.value))
  // The mock/demo transport intentionally surfaces the admin UI for the demo
  // identity (whose persisted role stays pinned to 1 as an anti-escalation
  // boundary, see demoStorage). Against the real backend these flags derive
  // from the server-issued role and fail closed. Neither is a server-side
  // authorization boundary.
  const isAdmin = computed(() =>
    isMockApi ? true : (user.value?.role ?? 0) >= 10
  )
  const isRoot = computed(() =>
    isMockApi ? false : (user.value?.role ?? 0) >= 100
  )
  const adminPermissions = computed<string[]>(() =>
    isMockApi ? [] : (user.value?.admin_permissions ?? [])
  )

  function persist(next: UserInfo | null): void {
    user.value = next
    try {
      if (next) writeDemoUser(next)
      else clearDemoUser()
    } catch {
      // Restricted storage degrades to the in-memory demo session.
    }
  }

  async function login(username: string, password: string): Promise<void> {
    const api = await getAuthApi()
    const data = await api.login(username, password)
    persist(data.user)
    checked.value = true
  }

  async function logout(): Promise<void> {
    const api = await getAuthApi()
    try {
      await api.logout()
    } finally {
      persist(null)
      checked.value = true
    }
  }

  async function fetchSelf(): Promise<boolean> {
    const api = await getAuthApi()
    try {
      const fresh = await api.self()
      persist(fresh)
      checked.value = true
      return true
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        persist(null)
        checked.value = true
        return false
      }

      // Keep checked=false so the next protected navigation retries.
      return Boolean(user.value)
    }
  }

  async function updateProfile(patch: UserProfilePatch): Promise<void> {
    const api = await getAuthApi()
    const data = await api.updateProfile(patch)
    persist(data.user)
  }

  async function deleteAccount(): Promise<void> {
    const api = await getAuthApi()
    await api.deleteSelf()
    persist(null)
    checked.value = true
  }

  setUnauthorizedHandler(() => {
    persist(null)
    checked.value = true
  })

  return {
    user,
    checked,
    isAuthenticated,
    isAdmin,
    isRoot,
    adminPermissions,
    login,
    logout,
    fetchSelf,
    updateProfile,
    deleteAccount,
    persist,
  }
})
