import { useState, useEffect, useCallback } from 'react'
import i18next from 'i18next'
import { toast } from 'sonner'
import { getUserProfile, updateUserProfile, updateUserSettings } from '../api'
import type {
  UserProfile,
  UpdateUserRequest,
  UpdateUserSettingsRequest,
} from '../types'

// ============================================================================
// Profile Hook
// ============================================================================

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  // Fetch user profile (with optional silent mode)
  const fetchProfile = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true)
      }
      const response = await getUserProfile()

      if (response.success && response.data) {
        setProfile(response.data)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch profile:', error)
      if (!silent) {
        toast.error(i18next.t('Failed to load profile'))
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [])

  // Refresh profile silently (without loading state)
  const refreshProfile = useCallback(async () => {
    await fetchProfile(true)
  }, [fetchProfile])

  // Update user profile
  const updateProfile = useCallback(
    async (data: UpdateUserRequest): Promise<boolean> => {
      try {
        setUpdating(true)
        const response = await updateUserProfile(data)

        if (response.success) {
          toast.success(i18next.t('Profile updated successfully'))
          await refreshProfile() // Refresh profile silently
          return true
        }

        toast.error(response.message || i18next.t('Failed to update profile'))
        return false
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to update profile:', error)
        toast.error(i18next.t('Failed to update profile'))
        return false
      } finally {
        setUpdating(false)
      }
    },
    [refreshProfile]
  )

  // Update user settings
  const updateSettings = useCallback(
    async (data: UpdateUserSettingsRequest): Promise<boolean> => {
      try {
        setUpdating(true)
        const response = await updateUserSettings(data)

        if (response.success) {
          toast.success(i18next.t('Settings updated successfully'))
          await refreshProfile() // Refresh profile silently
          return true
        }

        toast.error(response.message || i18next.t('Failed to update settings'))
        return false
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to update settings:', error)
        toast.error(i18next.t('Failed to update settings'))
        return false
      } finally {
        setUpdating(false)
      }
    },
    [refreshProfile]
  )

  // Initial fetch
  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  return {
    profile,
    loading,
    updating,
    fetchProfile,
    refreshProfile,
    updateProfile,
    updateSettings,
  }
}
