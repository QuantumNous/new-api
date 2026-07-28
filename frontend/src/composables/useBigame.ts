import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import type {
  GameWallet,
  MilestoneItem,
  SpinPrize,
  BlindBoxPrize,
  PrizeRecord,
} from '@/types/bigame'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'

/**
 * Bigame welfare system state + actions.
 * Owns wallet, milestones, spin/box results and prize history.
 */
export function useBigame() {
  const { t } = useI18n()
  const toast = useToast()
  const auth = useAuthStore()

  const loading = ref(true)
  const spinning = ref(false)
  const opening = ref(false)

  const wallet = ref<GameWallet | null>(null)
  const milestones = ref<MilestoneItem[]>([])
  const prizes = ref<SpinPrize[]>([])
  const records = ref<PrizeRecord[]>([])

  // Last result shown in the result overlay
  const lastSpinPrize = ref<SpinPrize | null>(null)
  const lastBoxPrize = ref<BlindBoxPrize | null>(null)

  async function load() {
    loading.value = true
    try {
      const data = await api.get<{
        wallet: GameWallet
        milestones: MilestoneItem[]
        prizes: SpinPrize[]
        records: PrizeRecord[]
      }>('/api/bigame/self')
      wallet.value = data.wallet
      milestones.value = data.milestones
      prizes.value = data.prizes
      records.value = data.records
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : t('common.failed')
      )
    } finally {
      loading.value = false
    }
  }

  async function spin() {
    if (!wallet.value || wallet.value.balance < 5) {
      toast.error(t('bigame.spinWheel.noCoins'))
      return
    }
    spinning.value = true
    lastSpinPrize.value = null
    try {
      const res = await api.post<{ prize: SpinPrize; wallet: GameWallet }>(
        '/api/bigame/spin'
      )
      if (res.prize.type === 'quota') await auth.fetchSelf()
      wallet.value = res.wallet
      lastSpinPrize.value = res.prize
      records.value.unshift({
        id: Date.now(),
        source: 'spin',
        prize_label: res.prize.label,
        rarity: 'common',
        value: res.prize.value,
        type: res.prize.type === 'nothing' ? 'coins' : res.prize.type,
        created: Math.floor(Date.now() / 1000),
      })
      toast.success(t('bigame.spinWheel.result', { prize: res.prize.label }))
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : String(e))
    } finally {
      spinning.value = false
    }
  }

  async function openBox() {
    if (!wallet.value || wallet.value.balance < 10) {
      toast.error(t('bigame.blindBox.noCoins'))
      return
    }
    opening.value = true
    lastBoxPrize.value = null
    try {
      const res = await api.post<{ prize: BlindBoxPrize; wallet: GameWallet }>(
        '/api/bigame/box'
      )
      if (res.prize.type === 'quota') await auth.fetchSelf()
      wallet.value = res.wallet
      lastBoxPrize.value = res.prize
      records.value.unshift({
        id: Date.now(),
        source: 'box',
        prize_label: res.prize.label,
        rarity: res.prize.rarity,
        value: res.prize.value,
        type: res.prize.type,
        created: Math.floor(Date.now() / 1000),
      })
      toast.success(
        t('bigame.blindBox.result', {
          rarity: t(`bigame.blindBox.rarity.${res.prize.rarity}`),
          prize: res.prize.label,
        })
      )
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : String(e))
    } finally {
      opening.value = false
    }
  }

  async function claimMilestone(id: string) {
    try {
      const res = await api.post<{ wallet: GameWallet }>(
        '/api/bigame/milestone/claim',
        { id }
      )
      wallet.value = res.wallet
      const ms = milestones.value.find((m) => m.id === id)
      if (ms) ms.claimed = true
      toast.success(t('bigame.milestone.claim') + ' ✓')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : String(e))
    }
  }

  return {
    loading,
    spinning,
    opening,
    wallet,
    milestones,
    prizes,
    records,
    lastSpinPrize,
    lastBoxPrize,
    load,
    spin,
    openBox,
    claimMilestone,
  }
}
