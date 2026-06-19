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
import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  getCryptoDepositConfig,
  createCryptoDeposit,
  getCryptoDepositStatus,
  cancelCryptoDeposit,
} from '../api'
import type { CryptoDepositConfig, CryptoDepositOrder } from '../types'
import { CRYPTO_DEPOSIT_STATUS } from '../types'
import {
  Copy,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Wallet,
  ArrowRight,
} from 'lucide-react'

interface CryptoDepositDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

type Step = 'form' | 'instructions' | 'verifying' | 'success' | 'failed'

export function CryptoDepositDialog({
  open,
  onOpenChange,
  onSuccess,
}: CryptoDepositDialogProps) {
  const { t } = useTranslation()
  const [config, setConfig] = useState<CryptoDepositConfig | null>(null)
  const [step, setStep] = useState<Step>('form')
  const [coin, setCoin] = useState('USDT')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [order, setOrder] = useState<CryptoDepositOrder | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load config on open
  useEffect(() => {
    if (open) {
      getCryptoDepositConfig().then((res) => {
        if (res.success && res.data) {
          setConfig(res.data)
          if (res.data.coins.length > 0) {
            setCoin(res.data.coins[0])
          }
        }
      })
      setStep('form')
      setOrder(null)
      setAmount('')
    } else {
      // Cleanup
      if (pollRef.current) clearInterval(pollRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [open])

  // Countdown timer
  useEffect(() => {
    if (order && (step === 'instructions' || step === 'verifying')) {
      const updateTimer = () => {
        const now = Math.floor(Date.now() / 1000)
        const remaining = order.expires_at - now
        if (remaining <= 0) {
          setStep('failed')
          setTimeLeft(0)
          if (pollRef.current) clearInterval(pollRef.current)
          if (timerRef.current) clearInterval(timerRef.current)
        } else {
          setTimeLeft(remaining)
        }
      }
      updateTimer()
      timerRef.current = setInterval(updateTimer, 1000)
      return () => {
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }
  }, [order, step])

  // Poll for status
  const startPolling = useCallback(
    (orderId: string) => {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(async () => {
        try {
          const res = await getCryptoDepositStatus(orderId)
          if (res.success && res.data) {
            if (res.data.status === CRYPTO_DEPOSIT_STATUS.CONFIRMED) {
              setStep('success')
              if (pollRef.current) clearInterval(pollRef.current)
              if (timerRef.current) clearInterval(timerRef.current)
              onSuccess?.()
            } else if (
              res.data.status === CRYPTO_DEPOSIT_STATUS.EXPIRED ||
              res.data.status === CRYPTO_DEPOSIT_STATUS.CANCELLED
            ) {
              setStep('failed')
              if (pollRef.current) clearInterval(pollRef.current)
              if (timerRef.current) clearInterval(timerRef.current)
            }
          }
        } catch {
          // Ignore polling errors
        }
      }, 5000) // Poll every 5 seconds
    },
    [onSuccess]
  )

  const handleSubmit = async () => {
    const amountNum = parseFloat(amount)
    if (!config || isNaN(amountNum) || amountNum < config.min_deposit) {
      toast.error(
        t(`Minimum deposit is $${config?.min_deposit || 5}`)
      )
      return
    }

    setLoading(true)
    try {
      const res = await createCryptoDeposit({ coin, amount: amountNum })
      if (res.success && res.data) {
        setOrder(res.data)
        setStep('instructions')
      } else {
        toast.error(res.message || t('Failed to create deposit order'))
      }
    } catch {
      toast.error(t('Failed to create deposit order'))
    } finally {
      setLoading(false)
    }
  }

  const handleSent = () => {
    if (order) {
      setStep('verifying')
      startPolling(order.order_id)
    }
  }

  const handleCancel = async () => {
    if (order) {
      try {
        await cancelCryptoDeposit(order.order_id)
      } catch {
        // Ignore
      }
      if (pollRef.current) clearInterval(pollRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
      setStep('form')
      setOrder(null)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(t(`${label} copied!`))
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const presetAmounts = [5, 10, 20, 50, 100]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {t('Crypto Deposit')}
          </DialogTitle>
          <DialogDescription>
            {step === 'form' && t('Deposit via Binance Internal Transfer')}
            {step === 'instructions' && t('Send the exact amount below')}
            {step === 'verifying' && t('Verifying your payment...')}
            {step === 'success' && t('Deposit confirmed!')}
            {step === 'failed' && t('Deposit expired or cancelled')}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Amount Form */}
        {step === 'form' && config && (
          <div className="space-y-4">
            {/* Coin Selection */}
            <div className="space-y-2">
              <Label>{t('Select Coin')}</Label>
              <div className="flex gap-2">
                {config.coins.map((c) => (
                  <Button
                    key={c}
                    variant={coin === c ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCoin(c)}
                    className="flex-1"
                  >
                    {c}
                  </Button>
                ))}
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <Label>{t('Amount (USD)')}</Label>
              <Input
                type="number"
                min={config.min_deposit}
                step="1"
                placeholder={`Min $${config.min_deposit}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            {/* Preset Amounts */}
            <div className="flex flex-wrap gap-2">
              {presetAmounts.map((preset) => (
                <Button
                  key={preset}
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(String(preset))}
                  className={
                    amount === String(preset)
                      ? 'border-primary bg-primary/10'
                      : ''
                  }
                >
                  ${preset}
                </Button>
              ))}
            </div>

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={loading || !amount}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              {t('Continue')}
            </Button>
          </div>
        )}

        {/* Step 2: Payment Instructions */}
        {step === 'instructions' && order && (
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {t('Send exactly')}:
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-amber-700 dark:text-amber-400">
                    {order.amount.toFixed(2)} {order.coin}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() =>
                      copyToClipboard(order.amount.toFixed(2), 'Amount')
                    }
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {t('To Binance UID')}:
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold">
                    {order.binance_uid}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() =>
                      copyToClipboard(order.binance_uid, 'Binance UID')
                    }
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {t('Via')}:
                </span>
                <span className="text-sm font-medium">
                  Binance Internal Transfer
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {t('Order ID')}:
                </span>
                <span className="font-mono text-sm">{order.order_id}</span>
              </div>
            </div>

            {/* Timer */}
            <div className="flex items-center justify-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-orange-500" />
              <span>
                {t('Complete within')}: {' '}
                <span className="font-mono font-bold text-orange-600">
                  {formatTime(timeLeft)}
                </span>
              </span>
            </div>

            {/* Warning */}
            <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
              ⚠️{' '}
              {t(
                'Send the EXACT amount shown above. Different amounts will not be matched automatically.'
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCancel}
              >
                {t('Cancel')}
              </Button>
              <Button className="flex-1" onClick={handleSent}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {t("I've Sent")}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Verifying */}
        {step === 'verifying' && order && (
          <div className="space-y-4 text-center py-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <div>
              <p className="font-medium">{t('Verifying payment...')}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('Checking Binance for your transfer of')}{' '}
                {order.amount.toFixed(2)} {order.coin}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="font-mono">{formatTime(timeLeft)}</span>
            </div>

            <p className="text-xs text-muted-foreground">
              {t('This usually takes 1-2 minutes')}
            </p>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
            >
              {t('Cancel')}
            </Button>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 'success' && order && (
          <div className="space-y-4 text-center py-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <div>
              <p className="text-lg font-bold text-green-600">
                {t('Deposit Successful!')}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                ${order.original_amount.toFixed(2)} {t('has been added to your account')}
              </p>
            </div>
            <div className="text-xs text-muted-foreground">
              {t('Order')}: {order.order_id}
            </div>
            <Button onClick={() => onOpenChange(false)} className="w-full">
              {t('Done')}
            </Button>
          </div>
        )}

        {/* Step 5: Failed/Expired */}
        {step === 'failed' && (
          <div className="space-y-4 text-center py-4">
            <XCircle className="h-16 w-16 text-red-500 mx-auto" />
            <div>
              <p className="text-lg font-bold text-red-600">
                {t('Deposit Expired')}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('The deposit order has expired or was cancelled.')}
              </p>
            </div>
            <Button
              onClick={() => {
                setStep('form')
                setOrder(null)
              }}
              className="w-full"
            >
              {t('Try Again')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
