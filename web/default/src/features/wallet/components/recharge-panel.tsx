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
import { useState, useEffect } from 'react'
import { Bitcoin, CreditCard, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { CryptoDepositModal } from './crypto-deposit-modal'
import { getTopupInfo, requestPayment, isApiSuccess } from '../api'
import { GLASS_CARD_CLS } from '../constants'
import type { TopupInfo } from '../types'

const PRESET_AMOUNTS = [10, 50, 100, 500, 1000, 5000]

interface RechargePanelProps {
  onSuccess: () => void
}

export function RechargePanel({ onSuccess }: RechargePanelProps) {
  const { t } = useTranslation()
  const [selectedAmount, setSelectedAmount] = useState<number>(50)
  const [customAmount, setCustomAmount] = useState('')
  const [cryptoOpen, setCryptoOpen] = useState(false)
  const [topupInfo, setTopupInfo] = useState<TopupInfo | null>(null)
  const [epayLoading, setEpayLoading] = useState<string | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null)

  const effectiveAmount = customAmount ? parseFloat(customAmount) || 0 : selectedAmount

  useEffect(() => {
    getTopupInfo()
      .then((res) => { if (res.success && res.data) setTopupInfo(res.data) })
      .catch(() => {})
  }, [])

  function handleCustomInput(v: string) {
    if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) {
      setCustomAmount(v)
      if (v) setSelectedAmount(0)
    }
  }

  function handlePresetClick(amount: number) {
    setSelectedAmount(amount)
    setCustomAmount('')
  }

  function handleMethodSelect(method: string) {
    setSelectedMethod(method)
  }

  async function handleEpayPay(method: string) {
    if (effectiveAmount <= 0) return
    setEpayLoading(method)
    try {
      const res = await requestPayment({
        amount: Math.round(effectiveAmount),
        payment_method: method,
      })
      if (isApiSuccess(res) && res.url) {
        // Epay requires all signed params submitted as a form POST to submit.php
        const params = res.data as Record<string, string>
        const form = document.createElement('form')
        form.method = 'POST'
        form.action = res.url
        form.target = '_blank'
        Object.entries(params).forEach(([key, value]) => {
          const input = document.createElement('input')
          input.type = 'hidden'
          input.name = key
          input.value = String(value)
          form.appendChild(input)
        })
        document.body.appendChild(form)
        form.submit()
        document.body.removeChild(form)
      } else {
        const msg = typeof res.data === 'string' ? res.data : t('Payment failed')
        toast.error(msg as string)
      }
    } catch {
      toast.error(t('Payment failed'))
    } finally {
      setEpayLoading(null)
    }
  }

  const epayEnabled = topupInfo?.enable_online_topup ?? false
  const epayMethods = topupInfo?.pay_methods ?? []
  const hasAlipay = false // Alipay not yet supported by current Epay integration
  const hasWechat = epayEnabled && epayMethods.some((m) => m.type === 'wxpay')

  return (
    <>
      <Card className={GLASS_CARD_CLS}>
        <CardHeader className='pb-3'>
          <h3 className='text-base font-semibold'>{t('Add Funds')}</h3>
        </CardHeader>
        <CardContent className='flex flex-col gap-4'>
          <div>
            <div className='text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider'>
              {t('Select Amount')}
            </div>
            <div className='grid grid-cols-3 gap-2'>
              {PRESET_AMOUNTS.map((amount) => {
                const active = selectedAmount === amount && !customAmount
                return (
                  <button
                    key={amount}
                    type='button'
                    onClick={() => handlePresetClick(amount)}
                    className={cn(
                      'rounded-lg border px-3 py-2.5 text-sm font-semibold transition-all',
                      active
                        ? 'border-cyan-400 bg-cyan-50 font-bold text-cyan-700'
                        : 'border-border hover:border-cyan-300 hover:bg-cyan-50/50 hover:text-cyan-700'
                    )}
                  >
                    ${amount}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className='text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider'>
              {t('Custom Amount (USD)')}
            </div>
            <div className='relative'>
              <span className='text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 text-sm'>
                $
              </span>
              <input
                type='text'
                inputMode='decimal'
                value={customAmount}
                onChange={(e) => handleCustomInput(e.target.value)}
                placeholder='0.00'
                className='border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-cyan-400 w-full rounded-lg border py-2 pl-7 pr-3 text-sm outline-none focus:ring-1 focus:ring-cyan-200'
              />
            </div>
          </div>

          <div>
            <div className='text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider'>
              {t('Payment Method')}
            </div>
            <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>

              {hasAlipay && (
                <button
                  type='button'
                  disabled={effectiveAmount <= 0 || epayLoading === 'alipay'}
                  onClick={() => { handleMethodSelect('alipay'); handleEpayPay('alipay') }}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40',
                    selectedMethod === 'alipay'
                      ? 'border-[#1677FF] bg-blue-50'
                      : 'border-border bg-white hover:border-[#1677FF]'
                  )}
                >
                  <div className='flex size-9 shrink-0 items-center justify-center rounded-lg' style={{ background: '#1677FF' }}>
                    {epayLoading === 'alipay'
                      ? <Loader2 className='size-4 animate-spin text-white' />
                      : <span className='text-sm font-bold text-white'>支</span>}
                  </div>
                  <div className='min-w-0'>
                    <div className='truncate text-sm font-semibold text-gray-800'>{t('Alipay')}</div>
                    <div className='truncate text-[11px] text-gray-400'>支付宝</div>
                  </div>
                </button>
              )}

              {hasWechat && (
                <button
                  type='button'
                  disabled={effectiveAmount <= 0 || epayLoading === 'wxpay'}
                  onClick={() => { handleMethodSelect('wxpay'); handleEpayPay('wxpay') }}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40',
                    selectedMethod === 'wxpay'
                      ? 'border-[#07C160] bg-green-50'
                      : 'border-border bg-white hover:border-[#07C160]'
                  )}
                >
                  <div className='flex size-9 shrink-0 items-center justify-center rounded-lg' style={{ background: '#07C160' }}>
                    {epayLoading === 'wxpay'
                      ? <Loader2 className='size-4 animate-spin text-white' />
                      : (
                        <svg viewBox='0 0 24 24' className='size-5 fill-white'>
                          <path d='M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.161 1.71-1.484 1.255-2.302 3.01-1.612 5.087.679 2.086 2.87 3.4 5.589 3.4.592 0 1.181-.08 1.761-.162a.476.476 0 0 1 .432.168l1.018.802a.335.335 0 0 0 .204.078.24.24 0 0 0 .166-.064.23.23 0 0 0 .064-.166.37.37 0 0 0-.028-.127l-.48-1.461a.512.512 0 0 1 .18-.569c1.648-1.195 2.593-2.88 2.115-4.782-.52-2.07-2.459-3.914-4.248-3.914zm-2.178 2.168c.527 0 .955.427.955.954s-.428.954-.955.954a.955.955 0 0 1-.957-.954c0-.527.43-.954.957-.954zm4.396 0c.527 0 .955.427.955.954s-.428.954-.955.954a.955.955 0 0 1-.957-.954c0-.527.43-.954.957-.954z'/>
                        </svg>
                      )}
                  </div>
                  <div className='min-w-0'>
                    <div className='truncate text-sm font-semibold text-gray-800'>{t('WeChat Pay')}</div>
                    <div className='truncate text-[11px] text-gray-400'>微信支付</div>
                  </div>
                </button>
              )}

              <button
                type='button'
                disabled={effectiveAmount <= 0}
                onClick={() => { handleMethodSelect('crypto'); setCryptoOpen(true) }}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40',
                  selectedMethod === 'crypto'
                    ? 'border-cyan-400 bg-cyan-50'
                    : 'border-border bg-white hover:border-cyan-400'
                )}
              >
                <div className='flex size-9 shrink-0 items-center justify-center rounded-lg' style={{ background: 'linear-gradient(135deg, #22d3ee, #0891b2)' }}>
                  <Bitcoin className='size-4 text-white' />
                </div>
                <div className='min-w-0'>
                  <div className='truncate text-sm font-semibold text-gray-800'>Crypto</div>
                  <div className='truncate text-[11px] text-gray-400'>USDT / USDC</div>
                </div>
              </button>

              <button
                type='button'
                disabled
                className='flex items-center gap-3 rounded-xl border border-border bg-white px-3 py-3 text-left opacity-40 cursor-not-allowed'
              >
                <div className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-gray-100'>
                  <CreditCard className='size-4 text-gray-400' />
                </div>
                <div className='min-w-0'>
                  <div className='truncate text-sm font-semibold text-gray-800'>Stripe</div>
                  <div className='truncate text-[11px] text-gray-400'>{t('Coming Soon')}</div>
                </div>
              </button>

            </div>

            {effectiveAmount > 0 && (
              <p className='text-muted-foreground mt-2 text-xs'>
                {t('You will pay')}:{' '}
                <span className='font-mono font-semibold text-cyan-600'>
                  ${effectiveAmount.toFixed(2)}
                </span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <CryptoDepositModal
        open={cryptoOpen}
        onOpenChange={setCryptoOpen}
        amount={effectiveAmount}
        onSuccess={() => {
          setCryptoOpen(false)
          onSuccess()
        }}
      />
    </>
  )
}
