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
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { FadeIn } from '@/components/page-transition'
import { usePlaygroundStore } from '@/stores/playground-store'

/** How long the mid-thread model-switch chip stays visible. */
const NOTICE_MS = 2500

/**
 * Ephemeral status chip for model switches. Replaces the old system-message
 * marker so switches never appear as copy/edit/delete-able chat turns.
 */
export function ModelSwitchNotice() {
  const { t } = useTranslation()
  const notice = usePlaygroundStore((state) => state.modelSwitchNotice)
  const clearModelSwitchNotice = usePlaygroundStore(
    (state) => state.clearModelSwitchNotice
  )

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => {
      clearModelSwitchNotice()
    }, NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice, clearModelSwitchNotice])

  if (!notice) return null

  return (
    <div
      className='pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center px-3'
      role='status'
      aria-live='polite'
    >
      <FadeIn key={notice.id}>
        <span className='bg-muted/90 text-muted-foreground ring-border/60 inline-flex max-w-full items-center rounded-full px-3 py-1 font-mono text-[11px] shadow-sm ring-1 backdrop-blur-sm'>
          <span className='truncate'>
            {t('Switched model')}: {notice.from} → {notice.to}
          </span>
        </span>
      </FadeIn>
    </div>
  )
}
