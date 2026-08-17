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
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Coins,
  ScanLine,
  Search,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { IconBadge } from '@/components/ui/icon-badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { getMezonTransactions } from '../api'
import type { MezonTransaction } from '../types'

interface MezonTopupSectionProps {
  treasuryAddress: string
  explorerUrl?: string
  onClaim: (txHash: string) => Promise<boolean>
  claiming: boolean
}

export function MezonTopupSection({
  treasuryAddress,
  explorerUrl,
  onClaim,
  claiming,
}: MezonTopupSectionProps) {
  const { t } = useTranslation()
  const [txHash, setTxHash] = useState('')
  const [copied, setCopied] = useState(false)
  const [recentTxs, setRecentTxs] = useState<MezonTransaction[]>([])
  const [txsLoading, setTxsLoading] = useState(false)
  const [txsFetched, setTxsFetched] = useState(false)

  const fetchTransactions = useCallback(async () => {
    try {
      setTxsLoading(true)
      const res = await getMezonTransactions()
      if (res.success && Array.isArray(res.data)) {
        setRecentTxs(res.data)
      }
      setTxsFetched(true)
    } catch {
      setTxsFetched(true)
    } finally {
      setTxsLoading(false)
    }
  }, [])

  const qrCodeValue = useMemo(
    () =>
      JSON.stringify({
        type: 'transfer_wallet',
        wallet_address: treasuryAddress,
      }),
    [treasuryAddress]
  )

  const handleCopy = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      toast.error(t('Copy failed, please copy manually'))
      return
    }
    try {
      await navigator.clipboard.writeText(treasuryAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('Copy failed, please copy manually'))
    }
  }

  const handleClaim = async () => {
    const success = await onClaim(txHash)
    if (success) {
      setTxHash('')
      fetchTransactions()
    }
  }

  const truncatedAddress =
    treasuryAddress.length > 16
      ? `${treasuryAddress.slice(0, 8)}…${treasuryAddress.slice(-8)}`
      : treasuryAddress

  return (
    <div className='space-y-2.5 border-t pt-4 sm:space-y-3 sm:pt-6'>
      <div className='flex items-center gap-2'>
        <IconBadge tone='info' size='xs'>
          <Coins />
        </IconBadge>
        <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
          {t('Mezon Đồng')}
        </Label>
      </div>

      {/* QR Code Section */}
      <div className='border-primary/30 bg-primary/5 rounded-lg border border-dashed p-3 sm:p-4'>
        <div className='flex items-center gap-1.5'>
          <ScanLine className='text-primary h-3.5 w-3.5' />
          <span className='text-primary text-xs font-semibold tracking-wider uppercase'>
            {t('Scan QR')}
          </span>
        </div>

        <div className='mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4'>
          <div className='shrink-0 rounded-md bg-white p-1.5 shadow-sm ring-1 ring-black/5'>
            <QRCodeSVG
              value={qrCodeValue}
              size={120}
              level='H'
              className='h-[120px] w-[120px]'
            />
          </div>

          <div className='flex-1 space-y-2 text-center sm:text-left'>
            <p className='text-muted-foreground text-xs sm:text-sm'>
              {t(
                'Open Mezon App, scan this QR code, and specify the number of đồng to transfer (1 đồng = 1 mzđ).'
              )}
            </p>
            <div className='flex items-center justify-center gap-1.5 sm:justify-start'>
              <span className='text-muted-foreground truncate font-mono text-xs'>
                {truncatedAddress}
              </span>
              <button
                type='button'
                onClick={handleCopy}
                className='text-muted-foreground hover:text-foreground shrink-0 transition'
                title={t('Copy address')}
              >
                {copied ? (
                  <Check className='h-3 w-3 text-green-600' />
                ) : (
                  <Copy className='h-3 w-3' />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Find & Claim Section */}
      <div className='space-y-2'>
        {/* Action buttons row */}
        <div className='flex items-center gap-2'>
          <Button
            type='button'
            onClick={fetchTransactions}
            disabled={txsLoading}
            variant='outline'
            size='sm'
            className='h-8 gap-1.5 text-xs'
          >
            {txsLoading ? (
              <Loader2 className='h-3.5 w-3.5 animate-spin' />
            ) : (
              <Search className='h-3.5 w-3.5' />
            )}
            {t('Find my transactions')}
          </Button>
          {explorerUrl && (
            <a
              href={`${explorerUrl}/wallets/${treasuryAddress}`}
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs font-medium transition'
            >
              {t('Explorer')}
              <ExternalLink className='h-3 w-3' />
            </a>
          )}
        </div>

        {/* Unclaimed transaction chips */}
        {txsFetched && recentTxs.filter((tx) => !tx.claimed).length > 0 && (
          <div className='flex flex-wrap gap-1.5'>
            {recentTxs
              .filter((tx) => !tx.claimed)
              .map((tx) => (
                <button
                  key={tx.hash}
                  type='button'
                  onClick={() => setTxHash(tx.hash)}
                  className={`border-primary/30 hover:bg-primary/10 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition ${
                    txHash === tx.hash
                      ? 'bg-primary/15 border-primary/50'
                      : 'bg-background'
                  }`}
                >
                  <span className='text-primary'>
                    {tx.dong} {t('đồng')}
                  </span>
                  <span className='text-muted-foreground font-mono'>
                    {tx.hash.slice(0, 6)}…{tx.hash.slice(-4)}
                  </span>
                </button>
              ))}
          </div>
        )}

        {txsFetched &&
          recentTxs.filter((tx) => !tx.claimed).length === 0 && (
            <p className='text-muted-foreground text-xs'>
              {t('No unclaimed transactions found. Paste a hash manually.')}
            </p>
          )}

        {/* Hash input + Claim */}
        <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-2'>
          <Input
            id='mezon-tx-hash'
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            placeholder={t('Paste the transaction hash (0x…)')}
            aria-label={t('Transaction hash')}
            className='h-9 min-w-0 font-mono text-xs'
          />
          <Button
            type='button'
            onClick={handleClaim}
            disabled={claiming || !txHash.trim()}
            variant='outline'
            className='h-9 px-4'
          >
            {claiming && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {t('Claim')}
          </Button>
        </div>
      </div>
    </div>
  )
}
