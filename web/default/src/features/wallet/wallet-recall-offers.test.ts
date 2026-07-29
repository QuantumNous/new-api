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
import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { api } from '@/lib/api'
import type { RecallOfferView } from './types'
import {
  refreshWalletRecallOffers,
  validateWalletRecallClaimAndRefresh,
} from './wallet-recall-offers'

describe('wallet recall offer loading', () => {
  beforeEach(() => {
    mock.restore()
  })

  test('normal wallet load requests account recall offers without a recall claim', async () => {
    const offers: RecallOfferView[] = []
    const loadingStates: boolean[] = []
    const setOffers = mock((nextOffers: RecallOfferView[]) => {
      offers.splice(0, offers.length, ...nextOffers)
    })
    const setLoading = mock((loading: boolean) => {
      loadingStates.push(loading)
    })
    const get = spyOn(api, 'get').mockResolvedValue({
      data: { success: true, data: [{ campaign_id: 1 }] },
    } as never)

    await refreshWalletRecallOffers({ setOffers, setLoading })

    expect(get).toHaveBeenCalledWith('/api/user/recall/offers')
    expect(setOffers).toHaveBeenCalledWith([{ campaign_id: 1 }])
    expect(loadingStates).toEqual([true, false])
    expect(offers).toEqual([{ campaign_id: 1 }])
  })

  test('invalid claim validation refreshes account offers from finally', async () => {
    const setOffers = mock(() => undefined)
    const setLoading = mock(() => undefined)
    const setView = mock(() => undefined)
    const setStatus = mock(() => undefined)
    const onInvalidClaim = mock(() => undefined)
    const get = spyOn(api, 'get').mockResolvedValue({
      data: { success: true, data: [] },
    } as never)
    const post = spyOn(api, 'post').mockResolvedValue({
      data: { success: false, message: 'invalid' },
    } as never)

    await refreshWalletRecallOffers({ setOffers, setLoading })
    await validateWalletRecallClaimAndRefresh({
      claim: 'stale-claim',
      onInvalidClaim,
      refreshOffers: () => refreshWalletRecallOffers({ setOffers, setLoading }),
      setStatus,
      setView,
    })

    expect(post.mock.calls[0]?.[0]).toBe('/api/user/recall/claim/validate')
    expect(get.mock.calls.map((call) => call[0])).toEqual([
      '/api/user/recall/offers',
      '/api/user/recall/offers',
    ])
    expect(onInvalidClaim).toHaveBeenCalledTimes(1)
    expect(setStatus).toHaveBeenCalledWith('invalid')
  })
})
