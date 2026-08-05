import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { clearDemoUser, readDemoUser, writeDemoUser } from '@/api/demoStorage'
import { isMockApi, setApiUnauthorizedHandler } from '@/api/client'
import {
  applyAuthRotation,
  clearAuthBundle,
  getAuthBundle,
  setAuthBundle,
} from '@/api/authSession'
import { ApiError } from '@/api/types'
import type {
  TwoFactorChallenge,
  UserInfo,
  UserProfilePatch,
} from '@/types/auth'

async function getAuthApi() {
  const { authApi } = await import('@/api/auth')
  return authApi
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserInfo | null>(isMockApi ? readDemoUser() : null)
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
  const adminPermissions = computed<Record<string, Record<string, boolean>>>(
    () => user.value?.permissions?.admin_permissions ?? {}
  )

  function persist(next: UserInfo | null): void {
    if (isMockApi) {
      if (next) writeDemoUser(next)
      else clearDemoUser()
    }
    user.value = next
  }

  function hasPermission(resource: string, action: string): boolean {
    if (isMockApi || isRoot.value) return true
    return adminPermissions.value[resource]?.[action] === true
  }

  async function login(
    username: string,
    password: string
  ): Promise<TwoFactorChallenge | null> {
    const api = await getAuthApi()
    const data = await api.login(username, password)
    if ('require_2fa' in data) return data
    if (!isMockApi) setAuthBundle(data)
    persist(data.user)
    checked.value = true
    return null
  }

  async function verifyTwoFactor(
    flowToken: string,
    code: string
  ): Promise<void> {
    const api = await getAuthApi()
    const bundle = await api.verifyTwoFactor(flowToken, code)
    if (!isMockApi) setAuthBundle(bundle)
    persist(bundle.user)
    checked.value = true
  }

  async function logout(): Promise<void> {
    const api = await getAuthApi()
    try {
      await api.logout()
    } finally {
      clearAuthBundle()
      persist(null)
      checked.value = true
    }
  }

  async function fetchSelf(): Promise<boolean> {
    const api = await getAuthApi()
    try {
      if (!isMockApi && !getAuthBundle()) {
        const bundle = await api.refreshSession()
        setAuthBundle(bundle)
        persist(bundle.user)
        checked.value = true
        return true
      }
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

      throw error
    }
  }

  async function updateProfile(patch: UserProfilePatch): Promise<void> {
    const api = await getAuthApi()
    await api.updateProfile(patch)
    persist(await api.self())
  }

  async function changePassword(
    originalPassword: string,
    password: string
  ): Promise<void> {
    const api = await getAuthApi()
    const rotation = await api.changePassword(originalPassword, password)
    if (!isMockApi) applyAuthRotation(rotation)
  }

  async function deleteAccount(): Promise<void> {
    const api = await getAuthApi()
    await api.deleteSelf()
    clearAuthBundle()
    persist(null)
    checked.value = true
  }

  setApiUnauthorizedHandler(() => {
    clearAuthBundle()
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
    hasPermission,
    login,
    verifyTwoFactor,
    logout,
    fetchSelf,
    updateProfile,
    changePassword,
    deleteAccount,
    persist,
  }
})
