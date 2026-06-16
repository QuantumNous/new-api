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
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { updateAutoTopup } from '../api'
import type { UserWalletData } from '../types'

// $5 USD = 1 unit = 500000 quota ⇒ $1 USD = 100000 quota. Charge presets in USD.
const QUOTA_PER_USD = 100000
const PRESETS_USD = [5, 10, 20, 100, 1000]
const DEFAULT_USD = 10

interface AutoTopupCardProps {
  user: UserWalletData | null
  onSaved?: () => void
}

export function AutoTopupCard({ user, onSaved }: AutoTopupCardProps) {
  const { t } = useTranslation()
  const hasCard = !!user?.stripe_customer

  const initUsd = user?.auto_topup_amount
    ? Math.round(user.auto_topup_amount / QUOTA_PER_USD)
    : DEFAULT_USD
  const [enabled, setEnabled] = useState<boolean>(
    user?.auto_topup_enabled ?? true // default ON
  )
  const [usd, setUsd] = useState<number>(
    PRESETS_USD.includes(initUsd) ? initUsd : DEFAULT_USD
  )
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const amountQuota = usd * QUOTA_PER_USD
    try {
      const res = await updateAutoTopup({
        auto_topup_enabled: enabled,
        auto_topup_amount: amountQuota,
        // recharge once balance drops below one auto-recharge's worth
        auto_topup_threshold: amountQuota,
      })
      if (res.success) {
        toast.success(t('Auto-recharge settings saved'))
        onSaved?.()
      } else {
        toast.error(res.message || t('Update failed'))
      }
    } catch {
      toast.error(t('Update failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className='flex flex-col gap-5 p-5 sm:p-6'>
        <div className='flex items-start justify-between gap-4'>
          <div className='flex items-center gap-2.5'>
            <RefreshCw className='text-muted-foreground size-5' strokeWidth={1.75} />
            <div>
              <p className='text-base font-semibold'>{t('Auto-recharge')}</p>
              <p className='text-muted-foreground text-sm'>
                {t('Never run out — top up automatically when your balance is low')}
              </p>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div>
          <p className='text-muted-foreground mb-2 text-sm'>
            {t('Each auto-recharge charges your saved card')}
          </p>
          <div className='flex flex-wrap gap-2'>
            {PRESETS_USD.map((p) => (
              <button
                key={p}
                type='button'
                onClick={() => setUsd(p)}
                disabled={!enabled}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                  usd === p
                    ? 'border-transparent bg-accent text-accent-foreground'
                    : 'border-border hover:bg-muted'
                }`}
              >
                ${p}
              </button>
            ))}
          </div>
        </div>

        <p className='text-muted-foreground text-xs leading-relaxed'>
          {t(
            'When your balance runs low we automatically charge the selected amount to the card saved on your last top-up, so your service never stops. You can turn this off anytime.'
          )}
          {!hasCard && (
            <span className='mt-1.5 block font-medium text-amber-600'>
              {t('Top up once with a card first to enable auto-recharge.')}
            </span>
          )}
        </p>

        <Button onClick={save} disabled={saving} className='w-fit'>
          {saving ? t('Saving...') : t('Save')}
        </Button>
      </CardContent>
    </Card>
  )
}
