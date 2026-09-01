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
import { BookOpen, Check, Copy, KeyRound, Link2, PartyPopper } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Link } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { useStatus } from '@/hooks/use-status'

const CONFETTI_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

/** Deterministic confetti layout so renders stay stable. */
const CONFETTI_PIECES = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 137) % 100}%`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  delay: `${(i % 6) * 0.09}s`,
  rotate: `${(i * 49) % 360}deg`,
}))

type KeyCreatedDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  createdKey: string
}

function CopyRow({
  label,
  value,
  icon,
  mono = true,
}: {
  label: string
  value: string
  icon: React.ReactNode
  mono?: boolean
}) {
  const { copyToClipboard } = useCopyToClipboard()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const ok = await copyToClipboard(value)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  return (
    <div className='border-border bg-muted/50 flex min-w-0 items-center gap-2 rounded-2xl border px-3 py-2.5'>
      <span className='text-primary shrink-0'>{icon}</span>
      <div className='min-w-0 flex-1'>
        <p className='text-muted-foreground text-[11px] font-medium'>{label}</p>
        <p
          className={`truncate text-sm ${mono ? 'font-mono' : 'font-medium'}`}
          title={value}
        >
          {value}
        </p>
      </div>
      <Button
        variant={copied ? 'default' : 'outline'}
        size='sm'
        className='dopa-spring shrink-0 rounded-full'
        onClick={handleCopy}
      >
        {copied ? (
          <Check className='dopa-pop-in size-3.5' />
        ) : (
          <Copy className='size-3.5' />
        )}
        <span className='sr-only'>{label}</span>
      </Button>
    </div>
  )
}

export function KeyCreatedDialog({
  open,
  onOpenChange,
  createdKey,
}: KeyCreatedDialogProps) {
  const { t } = useTranslation()
  const { status } = useStatus()

  const baseUrl = useMemo(() => {
    const raw =
      ((status as Record<string, unknown> | null)?.server_address as
        | string
        | undefined) || window.location.origin
    return raw.replace(/\/+$/, '')
  }, [status])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* grid-cols-[minmax(0,1fr)] keeps the single grid track clamped to the
          panel width so the long mono key truncates instead of stretching
          the track past max-w and clipping content on both sides. */}
      <DialogContent className='grid-cols-[minmax(0,1fr)] overflow-hidden rounded-3xl sm:max-w-md'>
        {/* Celebration confetti */}
        <div aria-hidden='true' className='pointer-events-none absolute inset-x-0 top-0 h-36'>
          {CONFETTI_PIECES.map((p, i) => (
            <span
              key={i}
              className='dopa-confetti-piece'
              style={{
                left: p.left,
                backgroundColor: p.color,
                animationDelay: p.delay,
                transform: `rotate(${p.rotate})`,
              }}
            />
          ))}
        </div>

        {/* min-w-0 on grid items: without it the no-wrap button text sets the
         * column's min-content wider than the panel and clips the dialog. */}
        <DialogHeader className='min-w-0 items-center text-center'>
          <div className='bg-primary/12 text-primary dopa-pop-in mx-auto flex size-14 items-center justify-center rounded-full'>
            <PartyPopper className='size-7' />
          </div>
          <DialogTitle className='text-xl font-extrabold'>
            {t('Your key is ready!')}
          </DialogTitle>
          <DialogDescription className='text-pretty'>
            {t(
              'Copy the two things below into your AI tool and you are good to go. The key is only shown once here, but you can always copy it again from the list.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className='flex min-w-0 flex-col gap-2.5'>
          <CopyRow
            label={t('Your new API key')}
            value={createdKey}
            icon={<KeyRound className='size-4' />}
          />
          <CopyRow
            label={t('Interface address (Base URL)')}
            value={baseUrl}
            icon={<Link2 className='size-4' />}
          />
        </div>

        <div className='flex min-w-0 flex-col gap-2'>
          <Button
            size='lg'
            className='dopa-press w-full min-w-0 rounded-full font-bold'
            render={<Link to='/guide' />}
          >
            <BookOpen className='size-4' />
            {t('Show me how to plug it into my tool')}
          </Button>
          <Button
            variant='ghost'
            className='w-full rounded-full'
            onClick={() => onOpenChange(false)}
          >
            {t('I know the drill, close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
