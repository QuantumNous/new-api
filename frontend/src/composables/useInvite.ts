import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import type { InviteInfo } from '@/types/console'
import { ApiError } from '@/api/types'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { QUOTA_PER_DOLLAR } from '@/utils/format'
import { safeExternalUrl } from '@/utils/safeUrl'

/**
 * Invite / rebate page state + actions. Keeps InviteView.vue focused on
 * layout by owning data loading, clipboard, share intents and the transfer
 * flow. Failures keep the cached info (contract §4 convention).
 */
export function useInvite() {
  const { t } = useI18n()
  const toast = useToast()
  const auth = useAuthStore()

  const info = ref<InviteInfo | null>(null)
  const loading = ref(true)
  const inviteLink = ref('')

  const transferOpen = ref(false)
  const transferDollars = ref<number | null>(null)
  const transferring = ref(false)

  /** Average reward per invitee, in quota. */
  const avgReward = computed(() => {
    if (!info.value || info.value.invited === 0) return 0
    return Math.round(info.value.reward_total / info.value.invited)
  })

  /** Rebate ratio as a whole-number percent for display (0.02 → 2). */
  const rebatePercent = computed(() =>
    info.value ? Math.round(info.value.rate * 100) : 0
  )

  async function load() {
    loading.value = true
    try {
      const data = await api.get<InviteInfo>('/api/invite/self')
      info.value = data
      inviteLink.value = `${window.location.origin}/auth/sign-up?aff=${data.code}`
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : t('common.failed')
      )
    } finally {
      loading.value = false
    }
  }

  async function writeClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t('common.copied'))
    } catch {
      // Insecure context / denied permission / lost focus — tell the user.
      toast.error(t('common.copyFailed'))
    }
  }

  async function copyCode() {
    if (!info.value) return
    await writeClipboard(info.value.code)
  }

  async function copyLink() {
    if (!inviteLink.value) return
    await writeClipboard(inviteLink.value)
  }

  function shareText() {
    return t('invite.shareText', { rate: rebatePercent.value })
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
    if (!transferDollars.value) return
    const quota = Math.round(transferDollars.value * QUOTA_PER_DOLLAR)
    transferring.value = true
    try {
      const res = await api.post<{ message: string }>('/api/invite/transfer', {
        amount: quota,
      })
      toast.success(res.message)
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
    inviteLink,
    avgReward,
    rebatePercent,
    transferOpen,
    transferDollars,
    transferring,
    load,
    copyCode,
    copyLink,
    shareX,
    shareTelegram,
    shareEmail,
    transfer,
  }
}
