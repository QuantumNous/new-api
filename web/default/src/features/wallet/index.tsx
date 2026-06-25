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
import { useState, useEffect, useCallback } from 'react'
import { getSelf } from '@/lib/api'
import { WalletStatsCard } from './components/wallet-stats-card'
import { RechargePanel } from './components/recharge-panel'
import { RedemptionCodeCard } from './components/redemption-code-card'
import { ReferralCard } from './components/referral-card'
import { TransactionHistory } from './components/transaction-history'
import { useClinkReturnConfirm } from './hooks/use-clink-return-confirm'
import type { UserWalletData } from './types'

export function Wallet() {
  const [user, setUser] = useState<UserWalletData | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [historyKey, setHistoryKey] = useState(0)

  const fetchUser = useCallback(async () => {
    try {
      setUserLoading(true)
      const response = await getSelf()
      if (response.success && response.data) {
        setUser(response.data as UserWalletData)
      }
    } catch {
      // ignore
    } finally {
      setUserLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  function handleSuccess() {
    fetchUser()
    setHistoryKey((k) => k + 1)
  }

  useClinkReturnConfirm(handleSuccess)

  return (
    <div className='w-full min-w-0 bg-gradient-to-br from-violet-50 via-rose-50 to-sky-50 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900'>
      <div className='space-y-5 p-6'>
        <WalletStatsCard user={user} loading={userLoading} />

        <div className='grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-start'>
          <RechargePanel onSuccess={handleSuccess} />

          <div className='flex flex-col gap-5'>
            <RedemptionCodeCard onSuccess={handleSuccess} />
            <ReferralCard user={user} onSuccess={handleSuccess} />
          </div>
        </div>

        <TransactionHistory key={historyKey} />
      </div>
    </div>
  )
}
