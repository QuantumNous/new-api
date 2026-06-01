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
import { useState } from 'react'
import { Gift, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useRedemption } from '../hooks'
import { GLASS_CARD_CLS } from '../constants'

interface RedemptionCodeCardProps {
  onSuccess: () => void
}

export function RedemptionCodeCard({ onSuccess }: RedemptionCodeCardProps) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const { redeeming, redeemCode } = useRedemption()

  async function handleRedeem() {
    if (!code.trim()) return
    const ok = await redeemCode(code.trim())
    if (ok) {
      setCode('')
      onSuccess()
    }
  }

  return (
    <Card className={GLASS_CARD_CLS}>
      <CardHeader className='pb-3'>
        <div className='flex items-center gap-2'>
          <Gift className='text-muted-foreground size-4' />
          <h3 className='text-base font-semibold'>{t('Redeem Code')}</h3>
        </div>
      </CardHeader>
      <CardContent className='flex flex-col gap-3'>
        <p className='text-muted-foreground text-sm'>
          {t('Enter a redemption code to add quota to your account.')}
        </p>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t('Enter code')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRedeem()
          }}
        />
        <Button
          onClick={handleRedeem}
          disabled={redeeming || !code.trim()}
          className='w-full'
        >
          {redeeming ? (
            <>
              <Loader2 className='mr-2 size-4 animate-spin' />
              {t('Redeeming…')}
            </>
          ) : (
            t('Redeem')
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
