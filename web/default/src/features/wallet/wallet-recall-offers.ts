/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { listRecallOffers, validateRecallClaim } from './lib/recall-claim'
import type { RecallClaimView, RecallOfferView } from './types'

export type WalletRecallClaimStatus =
  | 'idle'
  | 'loading'
  | 'active'
  | 'expired'
  | 'invalid'
  | 'unavailable'

type RefreshWalletRecallOffersParams = {
  setLoading: (loading: boolean) => void
  setOffers: (offers: RecallOfferView[]) => void
}

type ValidateWalletRecallClaimAndRefreshParams = {
  claim: string
  isCancelled?: () => boolean
  onInvalidClaim: () => void
  refreshOffers: () => void | Promise<void>
  setStatus: (status: WalletRecallClaimStatus) => void
  setView: (view: RecallClaimView | null) => void
}

export async function refreshWalletRecallOffers({
  setLoading,
  setOffers,
}: RefreshWalletRecallOffersParams): Promise<void> {
  try {
    setLoading(true)
    const response = await listRecallOffers()
    setOffers(response.success && response.data ? response.data : [])
  } catch {
    setOffers([])
  } finally {
    setLoading(false)
  }
}

export async function validateWalletRecallClaimAndRefresh({
  claim,
  isCancelled = () => false,
  onInvalidClaim,
  refreshOffers,
  setStatus,
  setView,
}: ValidateWalletRecallClaimAndRefreshParams): Promise<void> {
  try {
    const response = await validateRecallClaim({ claim })
    if (isCancelled()) {
      return
    }
    if (response.success && response.data) {
      setView(response.data)
      setStatus('active')
      return
    }

    const message = response.message?.toLowerCase() || ''
    onInvalidClaim()
    setStatus(message.includes('expired') ? 'expired' : 'invalid')
  } catch {
    if (!isCancelled()) {
      setStatus('unavailable')
    }
  } finally {
    if (!isCancelled()) {
      await refreshOffers()
    }
  }
}
