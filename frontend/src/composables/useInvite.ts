import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import { useFeatureAccess } from '@/composables/useFeatureAccess'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import type { InviteInfo } from '@/types/console'
import { QUOTA_PER_DOLLAR } from '@/utils/format'
import { safeExternalUrl } from '@/utils/safeUrl'

export function useInvite() {
  const { t } = useI18n()
  const toast = useToast()
  const auth = useAuthStore()
  const { readOnly } = useFeatureAccess('invites', 'disabled')

  const info = ref<InviteInfo | null>(null)
  const loading = ref(true)
  const loadError = ref<string | null>(null)
  const inviteLink = ref('')

  const transferOpen = ref(false)
  const transferDollars = ref<number | null>(null)
  const transferring = ref(false)

  async function load() {
    loading.value = true
    loadError.value = null
    try {
      const data = await api.get<InviteInfo>('/api/next/invite/self')
      info.value = data
      inviteLink.value = `${window.location.origin}/auth/sign-up?aff=${data.code}`
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : t('common.failed')
      loadError.value = message
      toast.error(message)
    } finally {
      loading.value = false
    }
  }

  async function writeClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t('common.copied'))
    } catch {
      toast.error(t('common.copyFailed'))
    }
  }

  async function copyCode() {
    if (info.value) await writeClipboard(info.value.code)
  }

  async function copyLink() {
    if (inviteLink.value) await writeClipboard(inviteLink.value)
  }

  function shareText() {
    return t('invite.shareText', {
      reward: `${info.value?.effective_rate_percent ?? 0}%`,
    })
  }

  function openShare(url: string, origin: string) {
    const safeUrl = safeExternalUrl(url, [origin])
    if (!safeUrl) {
      toast.error(t('common.failed'))
      return
    }
    window.open(safeUrl, '_blank', 'noopener,noreferrer')
  }

  function shareX() {
    openShare(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText())}&url=${encodeURIComponent(inviteLink.value)}`,
      'https://twitter.com'
    )
  }

  function shareTelegram() {
    openShare(
      `https://t.me/share/url?url=${encodeURIComponent(inviteLink.value)}&text=${encodeURIComponent(shareText())}`,
      'https://t.me'
    )
  }

  function shareEmail() {
    window.location.href = `mailto:?subject=${encodeURIComponent(shareText())}&body=${encodeURIComponent(inviteLink.value)}`
  }

  async function transfer() {
    const dollars = transferDollars.value
    if (readOnly.value || dollars === null || dollars < 1) return
    const quota = Math.round(dollars * QUOTA_PER_DOLLAR)
    transferring.value = true
    try {
      const response = await api.post<{ message: string }>(
        '/api/next/invite/transfer',
        { amount: quota }
      )
      toast.success(response.message)
      transferOpen.value = false
      transferDollars.value = null
      await Promise.all([auth.fetchSelf(), load()])
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : String(error))
    } finally {
      transferring.value = false
    }
  }

  return {
    info,
    loading,
    loadError,
    inviteLink,
    transferOpen,
    transferDollars,
    transferring,
    readOnly,
    load,
    copyCode,
    copyLink,
    shareX,
    shareTelegram,
    shareEmail,
    transfer,
  }
}
