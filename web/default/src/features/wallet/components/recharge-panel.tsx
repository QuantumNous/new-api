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
import { Bitcoin, CreditCard, Globe, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CryptoDepositModal } from './crypto-deposit-modal'
import { getTopupInfo, requestPayment, requestPayPalPayment, isApiSuccess, getUserBillingHistory, getFirstTopupPromo } from '../api'
import type { FirstTopupPromoInfo } from '../api'
import { paymentErrorMessage } from '../lib/payment'
import { GLASS_CARD_CLS, CLINK_LOCAL_METHODS } from '../constants'
import { useWaffoPancakePayment } from '../hooks/use-waffo-pancake-payment'
import { usePlategaPayment } from '../hooks/use-platega-payment'
import { useClinkPayment } from '../hooks/use-clink-payment'
import { WaffoPayMethodHints } from './waffo-pay-method-hints'
import { ClinkPayMethodHints } from './clink-pay-method-hints'
import type { TopupInfo } from '../types'

const HINT_LS_KEY = 'payment_hint_shown'
const HINT_COOLDOWN_MS = 24 * 60 * 60 * 1000

const PRESET_AMOUNTS_DEFAULT  = [10, 50, 100, 500, 1000]
const PRESET_AMOUNTS_NEW_USER = [1, 10, 50, 100, 500, 1000]

interface RechargePanelProps {
  onSuccess: () => void
  onPaymentAttempted?: () => void
  onPaymentSettled?: () => void
}

export function RechargePanel({ onSuccess, onPaymentAttempted, onPaymentSettled }: RechargePanelProps) {
  const { t } = useTranslation()
  const [selectedAmount, setSelectedAmount] = useState<number>(50)
  const [customAmount, setCustomAmount] = useState('')
  const [cryptoOpen, setCryptoOpen] = useState(false)
  const [topupInfo, setTopupInfo] = useState<TopupInfo | null>(null)
  const [epayLoading, setEpayLoading] = useState<string | null>(null)
  const [paypalLoading, setPaypalLoading] = useState(false)
  const { processing: pancakeLoading, processWaffoPancakePayment } = useWaffoPancakePayment()
  const { processing: plategaLoading, processPlategaPayment } = usePlategaPayment()
  const { processing: clinkLoading, processClinkPayment } = useClinkPayment()
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [promoInfo, setPromoInfo] = useState<FirstTopupPromoInfo | null>(null)
  const [isNewUser, setIsNewUser] = useState(false)
  const [countdown, setCountdown] = useState('')

  const effectiveAmount = customAmount ? parseFloat(customAmount) || 0 : selectedAmount

  const checkAndMaybeShowHint = useCallback(async () => {
    const last = localStorage.getItem(HINT_LS_KEY)
    if (last && Date.now() - Number(last) < HINT_COOLDOWN_MS) return
    try {
      const res = await getUserBillingHistory(1, 20, undefined, 'pending')
      if (!res.success || !res.data?.items) return
      const tenMinAgo = Date.now() / 1000 - 10 * 60
      const recent = res.data.items.filter((r) => r.create_time > tenMinAgo)
      if (recent.length < 2) return
      setShowHint(true)
      localStorage.setItem(HINT_LS_KEY, String(Date.now()))
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    window.addEventListener('focus', checkAndMaybeShowHint)
    return () => window.removeEventListener('focus', checkAndMaybeShowHint)
  }, [checkAndMaybeShowHint])

  useEffect(() => {
    getTopupInfo()
      .then((res) => { if (res.success && res.data) setTopupInfo(res.data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    getFirstTopupPromo().then((info) => {
      if (info?.never_recharged) setIsNewUser(true)
      if (info?.enabled && info?.eligible) setPromoInfo(info)
    })
  }, [])

  useEffect(() => {
    if (!promoInfo) return
    function tick() {
      const secs = Math.max(0, promoInfo!.expires_at - Math.floor(Date.now() / 1000))
      if (secs === 0) { setCountdown(''); return }
      const h = Math.floor(secs / 3600)
      const m = Math.floor((secs % 3600) / 60)
      const s = secs % 60
      setCountdown(`${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [promoInfo])

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
        onPaymentAttempted?.()
      } else {
        toast.error(paymentErrorMessage())
      }
    } catch {
      toast.error(paymentErrorMessage())
    } finally {
      setEpayLoading(null)
    }
  }

  async function handlePayPalPay() {
    const minTopup = topupInfo?.paypal_min_topup ?? 1
    if (effectiveAmount < minTopup) {
      toast.error(`${t('Minimum top-up')}: $${minTopup}`)
      return
    }
    setPaypalLoading(true)
    try {
      const res = await requestPayPalPayment({
        amount: Math.round(effectiveAmount),
        payment_method: 'paypal',
      })
      if (isApiSuccess(res) && res.data?.pay_link) {
        window.open(res.data.pay_link, '_blank')
        toast.success(t('Redirecting to payment page...'))
        onPaymentAttempted?.()
      } else {
        toast.error(paymentErrorMessage())
      }
    } catch {
      toast.error(paymentErrorMessage())
    } finally {
      setPaypalLoading(false)
    }
  }

  async function handlePancakePay() {
    const minTopup = topupInfo?.waffo_pancake_min_topup ?? 1
    if (effectiveAmount < minTopup) {
      toast.error(`${t('Minimum top-up')}: $${minTopup}`)
      return
    }
    handleMethodSelect('waffo_pancake')
    const ok = await processWaffoPancakePayment(Math.round(effectiveAmount))
    if (ok) onPaymentAttempted?.()
  }

  async function handlePlategaPay() {
    const minTopup = topupInfo?.platega_min_topup ?? 1
    if (effectiveAmount < minTopup) {
      toast.error(`${t('Minimum top-up')}: $${minTopup}`)
      return
    }
    handleMethodSelect('platega')
    const ok = await processPlategaPayment(Math.round(effectiveAmount))
    if (ok) onPaymentAttempted?.()
  }

  async function handleClinkPay() {
    const minTopup = topupInfo?.clink_min_topup ?? 1
    if (effectiveAmount < minTopup) {
      toast.error(`${t('Minimum top-up')}: $${minTopup}`)
      return
    }
    handleMethodSelect('clink')
    const ok = await processClinkPayment(Math.round(effectiveAmount))
    if (ok) onPaymentAttempted?.()
  }

  const epayEnabled = topupInfo?.enable_online_topup ?? false
  const paypalEnabled = topupInfo?.enable_paypal_topup ?? false
  const pancakeEnabled = topupInfo?.enable_waffo_pancake_topup ?? false
  const plategaEnabled = topupInfo?.enable_platega_topup ?? false
  const clinkEnabled = topupInfo?.enable_clink_topup ?? false
  const epayMethods = topupInfo?.pay_methods ?? []
  const hasAlipay = epayEnabled && epayMethods.some((m) => m.type === 'alipay')
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
              {(isNewUser ? PRESET_AMOUNTS_NEW_USER : PRESET_AMOUNTS_DEFAULT).map((amount) => {
                const active = selectedAmount === amount && !customAmount
                const isPromo = !!promoInfo && amount === promoInfo.amount
                return (
                  <button
                    key={amount}
                    type='button'
                    onClick={() => handlePresetClick(amount)}
                    className={cn(
                      'relative rounded-lg border px-3 py-2.5 text-sm font-semibold transition-all',
                      isPromo
                        ? 'border-amber-400 bg-amber-50 text-amber-800'
                        : active
                          ? 'border-cyan-400 bg-cyan-50 font-bold text-cyan-700'
                          : 'border-border hover:border-cyan-300 hover:bg-cyan-50/50 hover:text-cyan-700'
                    )}
                  >
                    {isPromo && (
                      <span className='absolute -right-1.5 -top-2.5 flex flex-col items-center rounded-md bg-amber-500 px-1.5 py-0.5 text-white shadow'>
                        <span className='text-[7px] font-semibold leading-tight tracking-wide uppercase opacity-90'>{t('New user')}</span>
                        <span className='text-[10px] font-extrabold leading-tight'>{Math.round((1 - promoInfo.discount) * 100)}% OFF</span>
                      </span>
                    )}
                    ${amount}
                    {isPromo && (
                      <div className='mt-0.5 text-[10px] font-normal text-amber-600'>
                        {t('pay ${{pay}} → get ${{amount}}', { pay: promoInfo.pay_amount.toFixed(2), amount: promoInfo.amount })}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            {promoInfo && countdown && (
              <div className='mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs'>
                <span className='font-semibold text-amber-700'>
                  {t('🎁 New user exclusive · {{pct}}% off first top-up', { pct: Math.round((1 - promoInfo.discount) * 100) })}
                </span>
                <span className='ml-auto font-mono text-amber-600'>{t('Expires in')} {countdown}</span>
              </div>
            )}
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

              {paypalEnabled && (
                <button
                  type='button'
                  disabled={effectiveAmount <= 0 || paypalLoading}
                  onClick={() => { handleMethodSelect('paypal'); handlePayPalPay() }}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40',
                    selectedMethod === 'paypal'
                      ? 'border-[#003087] bg-blue-50'
                      : 'border-border bg-white hover:border-[#003087]'
                  )}
                >
                  <div className='flex size-9 shrink-0 items-center justify-center rounded-lg' style={{ background: '#003087' }}>
                    {paypalLoading
                      ? <Loader2 className='size-4 animate-spin text-white' />
                      : (
                        <svg viewBox='0 0 24 24' className='size-5 fill-white' aria-hidden='true'>
                          <path d='M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 2.901C5.026 2.318 5.474 1.9 6.07 1.9h4.674c3.476 0 5.705 1.657 5.083 5.093-.49 2.735-2.278 4.016-4.692 4.016H8.785a.641.641 0 0 0-.633.545l-.634 4.032a.641.641 0 0 1-.633.545h-.009zm.633-7.337h1.272c2.157 0 3.477-1.016 3.929-3.172.35-1.658-.002-2.558-1.032-3.084-.348-.189-.804-.283-1.356-.283H8.016l-.307 6.539z' />
                        </svg>
                      )}
                  </div>
                  <div className='min-w-0'>
                    <div className='truncate text-sm font-semibold text-gray-800'>PayPal</div>
                    <div className='truncate text-[11px] text-gray-400'>{t('Credit / Debit')}</div>
                  </div>
                </button>
              )}

              {pancakeEnabled && (
                <button
                  type='button'
                  disabled={effectiveAmount <= 0 || pancakeLoading}
                  onClick={handlePancakePay}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40',
                    selectedMethod === 'waffo_pancake'
                      ? 'border-orange-400 bg-orange-50'
                      : 'border-border bg-white hover:border-orange-400'
                  )}
                >
                  <div className='flex size-9 shrink-0 items-center justify-center rounded-lg' style={{ background: 'linear-gradient(135deg, #fb923c, #ea580c)' }}>
                    {pancakeLoading
                      ? <Loader2 className='size-4 animate-spin text-white' />
                      : <span className='text-sm font-bold tracking-tight text-white'>W</span>}
                  </div>
                  <div className='min-w-0'>
                    <div className='truncate text-sm font-semibold text-gray-800'>{t('Waffo Pay')}</div>
                    <WaffoPayMethodHints />
                  </div>
                </button>
              )}

              {plategaEnabled && (
                <button
                  type='button'
                  disabled={effectiveAmount <= 0 || plategaLoading}
                  onClick={handlePlategaPay}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40',
                    selectedMethod === 'platega'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-border bg-white hover:border-blue-500'
                  )}
                >
                  <div className='flex size-9 shrink-0 items-center justify-center rounded-lg' style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
                    {plategaLoading
                      ? <Loader2 className='size-4 animate-spin text-white' />
                      : <span className='text-xs font-bold text-white'>₽</span>}
                  </div>
                  <div className='min-w-0'>
                    <div className='truncate text-sm font-semibold text-gray-800'>{t('Russian SBP QR')}</div>
                    <div className='truncate text-[11px] text-gray-400'>{t('Russian SBP QR hint')}</div>
                  </div>
                </button>
              )}

              {clinkEnabled && (
                <TooltipProvider delay={0}>
                  <Tooltip>
                    <TooltipTrigger render={
                      <button
                        type='button'
                        disabled={effectiveAmount <= 0 || clinkLoading}
                        onClick={handleClinkPay}
                        className={cn(
                          'flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40',
                          selectedMethod === 'clink'
                            ? 'border-green-500 bg-green-50'
                            : 'border-border bg-white hover:border-green-500'
                        )}
                      >
                        <div className='flex size-9 shrink-0 items-center justify-center rounded-lg' style={{ background: 'linear-gradient(135deg, #22c55e, #15803d)' }}>
                          {clinkLoading
                            ? <Loader2 className='size-4 animate-spin text-white' />
                            : <Globe className='size-4 text-white' />}
                        </div>
                        <div className='min-w-0'>
                          <div className='truncate text-sm font-semibold text-gray-800'>Clink</div>
                          <ClinkPayMethodHints />
                        </div>
                      </button>
                    } />
                    <TooltipContent className='max-w-[260px]'>
                      <div className='space-y-1.5'>
                        <div className='text-[11px] font-semibold'>{t('Global cards and local methods')}</div>
                        <div className='flex flex-col gap-1'>
                          {CLINK_LOCAL_METHODS.map((m) => (
                            <div key={m.code} className='flex items-center gap-2 text-[11px]'>
                              <span className='inline-flex w-6 shrink-0 justify-center rounded bg-white/20 px-1 py-px font-mono text-[10px]'>{m.code}</span>
                              <span className='font-medium'>{m.method}</span>
                              <span className='ml-auto opacity-70'>{m.currency}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
                    <div className='truncate text-[11px] text-gray-400'>{t('Alipay')}</div>
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
                    <div className='truncate text-[11px] text-gray-400'>{t('WeChat Pay')}</div>
                  </div>
                </button>
              )}

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

            <div className='mt-3 flex items-center justify-between'>
              {effectiveAmount > 0
                ? (
                  <p className='text-muted-foreground text-xs'>
                    {t('You will pay')}:{' '}
                    <span className='font-mono font-semibold text-cyan-600'>
                      ${effectiveAmount.toFixed(2)}
                    </span>
                  </p>
                )
                : <span />}
              <a
                href='https://t.me/apimasterai/73'
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center gap-1.5 rounded-full bg-[#229ED9]/10 px-3 py-1.5 text-xs font-semibold text-[#229ED9] transition-colors hover:bg-[#229ED9]/20'
              >
                <svg viewBox='0 0 24 24' className='size-3.5 shrink-0 fill-current' aria-hidden='true'>
                  <path d='M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z'/>
                </svg>
                {t('Payment issue? Contact us')}
              </a>
            </div>
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
        onSettled={onPaymentSettled}
      />

      <Dialog open={showHint} onOpenChange={setShowHint}>
        <DialogContent className='max-w-sm text-center' showCloseButton>
          <DialogHeader className='items-center gap-3'>
            <div className='flex size-12 items-center justify-center rounded-full bg-[#229ED9]/10'>
              <svg viewBox='0 0 24 24' className='size-6 fill-[#229ED9]' aria-hidden='true'>
                <path d='M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z'/>
              </svg>
            </div>
            <DialogTitle className='text-base'>{t('Having trouble with payment?')}</DialogTitle>
            <DialogDescription className='text-sm'>
              {t('Our team is ready to help on Telegram')}
            </DialogDescription>
          </DialogHeader>
          <a
            href='https://t.me/apimasterai/73'
            target='_blank'
            rel='noopener noreferrer'
            onClick={() => setShowHint(false)}
            className='mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-[#229ED9] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1a8abf]'
          >
            <svg viewBox='0 0 24 24' className='size-4 fill-white' aria-hidden='true'>
              <path d='M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z'/>
            </svg>
            {t('Get help on Telegram')}
          </a>
        </DialogContent>
      </Dialog>
    </>
  )
}
