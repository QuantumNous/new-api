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
import { Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  CHAINS,
  NATIVE_COINGECKO,
  fetchNativePrice,
  useCryptoPayment,
  type ChainConfig,
  type TokenConfig,
} from '../hooks/use-crypto-payment'

interface CryptoDepositModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  amount: number
  onSuccess: () => void
  onSettled?: () => void
}

const CHAIN_EXPLORERS: Record<string, string> = {
  bsc:      'https://bscscan.com/tx/',
  base:     'https://basescan.org/tx/',
  arbitrum: 'https://arbiscan.io/tx/',
  polygon:  'https://polygonscan.com/tx/',
  eth:      'https://etherscan.io/tx/',
}

function shortAddr(addr: string) {
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}

export function CryptoDepositModal({
  open,
  onOpenChange,
  amount,
  onSuccess,
  onSettled,
}: CryptoDepositModalProps) {
  const { t } = useTranslation()
  const [selectedChain, setSelectedChain] = useState<ChainConfig>(CHAINS[1]) // BSC default
  const [selectedToken, setSelectedToken] = useState<TokenConfig>(CHAINS[1].tokens[0])

  const { step, error, txHash, usdAdded, walletAddress, startPayment, reset } =
    useCryptoPayment()
  const [displayPrice, setDisplayPrice] = useState(0)

  useEffect(() => {
    if (!open) return
    const cgId = NATIVE_COINGECKO[selectedChain.id] ?? 'ethereum'
    fetchNativePrice(cgId).then(setDisplayPrice).catch(() => {})
  }, [open, selectedChain.id])

  function handleChainChange(chain: ChainConfig) {
    setSelectedChain(chain)
    setSelectedToken(chain.tokens[0])
  }

  function handleClose() {
    if (step === 'done') onSuccess()
    if (step === 'done' || step === 'failed') onSettled?.()
    reset()
    onOpenChange(false)
  }

  const isNativeToken = selectedToken.isNative
  const nativeAmount = isNativeToken && displayPrice > 0
    ? (amount / displayPrice).toFixed(6)
    : null

  const isProcessing = ['connecting', 'switching', 'confirming', 'processing'].includes(step)

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('Crypto Deposit')}</DialogTitle>
          <DialogDescription>
            {t('Pay {{amount}} USD using crypto on-chain', { amount: amount.toFixed(2) })}
          </DialogDescription>
        </DialogHeader>

        {/* ── 表单 ── */}
        {step === 'form' && (
          <div className='flex flex-col gap-5 py-1'>

            {/* 钱包地址 */}
            {walletAddress && (
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>{t('Wallet')}</span>
                <span className='flex items-center gap-1.5 rounded-full border border-green-300 bg-green-50 px-3 py-0.5 text-xs font-mono text-green-700'>
                  <span className='size-1.5 rounded-full bg-green-500' />
                  {shortAddr(walletAddress)}
                </span>
              </div>
            )}

            {/* 网络选择 chip */}
            <div>
              <div className='text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider'>
                {t('Network')}
              </div>
              <div className='flex flex-wrap gap-2'>
                {CHAINS.map((c) => (
                  <button
                    key={c.id}
                    type='button'
                    onClick={() => handleChainChange(c)}
                    className={cn(
                      'rounded-xl border px-4 py-2 text-sm font-semibold transition-all',
                      selectedChain.id === c.id
                        ? 'border-cyan-400 bg-cyan-50 text-cyan-700'
                        : 'border-border hover:border-cyan-300 hover:bg-cyan-50/40'
                    )}
                  >
                    {c.shortLabel}
                  </button>
                ))}
              </div>
              <p className='text-muted-foreground mt-1.5 text-xs'>{selectedChain.name}</p>
            </div>

            {/* 代币选择 chip */}
            <div>
              <div className='text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider'>
                {t('Token')}
              </div>
              <div className='flex flex-wrap gap-2'>
                {selectedChain.tokens.map((tok) => (
                  <button
                    key={tok.symbol}
                    type='button'
                    onClick={() => setSelectedToken(tok)}
                    className={cn(
                      'rounded-xl border px-4 py-2 text-sm font-semibold transition-all',
                      selectedToken.symbol === tok.symbol
                        ? 'border-cyan-400 bg-cyan-50 text-cyan-700'
                        : 'border-border hover:border-cyan-300 hover:bg-cyan-50/40'
                    )}
                  >
                    {tok.symbol}
                  </button>
                ))}
              </div>
            </div>

            {/* 金额预览 */}
            <div className='rounded-xl bg-muted/30 px-4 py-3'>
              <div className='text-muted-foreground mb-1 text-xs'>{t('Amount to send')}</div>
              {isNativeToken ? (
                <div>
                  <div className='font-mono text-xl font-bold'>
                    ≈ {nativeAmount ?? '…'} {selectedToken.symbol}
                  </div>
                  <div className='text-muted-foreground mt-0.5 text-xs'>
                    {t('≈ ${{amount}} USD', { amount: amount.toFixed(2) })}
                    {displayPrice > 0 && (
                      <span className='ml-1'>
                        · 1 {selectedToken.symbol} = ${displayPrice.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className='text-muted-foreground mt-0.5 text-xs'>
                    {t('on {{chain}}', { chain: selectedChain.name })}
                  </div>
                  <p className='mt-2 text-[11px] text-amber-600'>
                    {t('Exact amount will be determined by your wallet at time of sending.')}
                  </p>
                </div>
              ) : (
                <div>
                  <div className='font-mono text-xl font-bold'>
                    ${amount.toFixed(2)} {selectedToken.symbol}
                  </div>
                  <div className='text-muted-foreground mt-0.5 text-xs'>
                    {t('on {{chain}}', { chain: selectedChain.name })}
                  </div>
                </div>
              )}
            </div>

            <Button
              className='w-full'
              style={{ background: 'linear-gradient(135deg, #22d3ee, #0891b2)' }}
              onClick={() => startPayment(amount, selectedChain, selectedToken)}
            >
              {walletAddress ? t('Confirm & Pay') : t('Connect Wallet & Pay')}
            </Button>
          </div>
        )}

        {/* ── 处理中 ── */}
        {isProcessing && (
          <div className='flex flex-col items-center gap-4 py-8 text-center'>
            <Loader2 className='size-10 animate-spin text-cyan-500' />
            <div>
              <div className='font-semibold'>
                {step === 'connecting' && t('Connecting wallet…')}
                {step === 'switching'  && t('Switching network…')}
                {step === 'confirming' && t('Waiting for wallet confirmation…')}
                {step === 'processing' && t('Waiting for on-chain confirmation…')}
              </div>
              {txHash && (
                <a
                  href={`${CHAIN_EXPLORERS[selectedChain.id] ?? ''}${txHash}`}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-muted-foreground mt-1 flex items-center justify-center gap-1 text-xs hover:underline'
                >
                  {t('View on explorer')} <ExternalLink className='size-3' />
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── 成功 ── */}
        {step === 'done' && (
          <div className='flex flex-col items-center gap-4 py-8 text-center'>
            <CheckCircle2 className='size-10 text-green-500' />
            <div>
              <div className='font-semibold text-green-600'>{t('Deposit confirmed!')}</div>
              <div className='text-muted-foreground mt-1 text-sm'>
                {t('${{amount}} USD added to your balance', { amount: usdAdded.toFixed(2) })}
              </div>
            </div>
            <Button onClick={handleClose}>{t('Close')}</Button>
          </div>
        )}

        {/* ── 失败 ── */}
        {step === 'failed' && (
          <div className='flex flex-col items-center gap-4 py-8 text-center'>
            <XCircle className='size-10 text-destructive' />
            <div>
              <div className='font-semibold text-destructive'>{t('Payment failed')}</div>
              {error && <div className='text-muted-foreground mt-1 text-sm'>{error}</div>}
            </div>
            <div className='flex gap-2'>
              <Button variant='outline' onClick={reset}>{t('Try again')}</Button>
              <Button variant='ghost' onClick={handleClose}>{t('Close')}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
