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
import { MessagesSquare } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  SUPPORT_QQ_GROUP,
  SUPPORT_QQ_GROUP_INVITE_URL,
} from '@/lib/support-contact'

type CommunityHelpVariant = 'console' | 'header'

type CommunityHelpProps = {
  /**
   * `console` keeps the lime console button, `header` uses a prominent site
   * header action whose label only collapses on phone-sized screens.
   */
  variant?: CommunityHelpVariant
}

const VARIANT_CLASSNAMES = {
  console: {
    trigger: 'ci-button ci-button--lime ci-button--size-xs',
    panel: 'ci-appHelpPanel',
    label: undefined,
    qr: undefined,
    title: undefined,
    hint: undefined,
  },
  header: {
    trigger:
      'ci-communityTrigger bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-primary px-3 text-sm font-semibold shadow-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
    panel:
      'border-border bg-background text-foreground absolute top-[calc(100%+10px)] right-0 z-30 grid w-60 justify-items-center gap-2.5 rounded-2xl border p-4 text-center shadow-xl',
    label: 'hidden whitespace-nowrap sm:inline',
    qr: 'size-[180px] shrink-0 rounded-lg bg-white object-contain',
    title: 'text-[13px]',
    hint: 'text-muted-foreground text-xs leading-snug',
  },
} as const

export function CommunityHelp(props: CommunityHelpProps = {}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const styles = VARIANT_CLASSNAMES[props.variant ?? 'console']
  const isHeader = props.variant === 'header'
  const label = t('Community')

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className='ci-appHelp' ref={rootRef}>
      <button
        type='button'
        className={styles.trigger}
        aria-expanded={open}
        aria-label={isHeader ? label : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {isHeader ? (
          <MessagesSquare className='size-4 shrink-0' aria-hidden='true' />
        ) : null}
        <span className={styles.label}>{label}</span>
      </button>
      {open ? (
        <div className={styles.panel} role='dialog' aria-label={label}>
          <img
            src='/qq-community-qr.png'
            alt={t('QQ after-sales group QR code')}
            width={180}
            height={180}
            className={styles.qr}
          />
          <strong className={styles.title}>
            {t('QQ group: {{group}}', { group: SUPPORT_QQ_GROUP })}
          </strong>
          <p className={styles.hint}>
            {t('Scan to join the QQ group for setup help.')}
          </p>
          <a
            href={SUPPORT_QQ_GROUP_INVITE_URL}
            target='_blank'
            rel='noreferrer noopener'
            className='bg-primary text-primary-foreground hover:bg-primary/90 inline-flex w-full items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold transition-colors'
          >
            {t('Click to join')}
          </a>
        </div>
      ) : null}
    </div>
  )
}
