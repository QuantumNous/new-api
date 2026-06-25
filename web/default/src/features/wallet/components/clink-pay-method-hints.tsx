/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useTranslation } from 'react-i18next'
import { CLINK_LOCAL_METHODS, CLINK_STRIP_VISIBLE } from '../constants'

/**
 * Compact "local methods by country" strip for the Clink top-up entry.
 * Renders a few country codes as pills (+N for the rest) instead of listing
 * every method. Country codes render identically on every OS (no emoji-flag
 * gaps on Windows). The full mapping lives in the button's hover tooltip.
 */
export function ClinkPayMethodHints() {
  const { t } = useTranslation()
  const visible = CLINK_LOCAL_METHODS.slice(0, CLINK_STRIP_VISIBLE)
  const rest = CLINK_LOCAL_METHODS.length - visible.length
  const srLabel = CLINK_LOCAL_METHODS.map((m) => m.method).join(', ')

  return (
    <div className='mt-0.5 flex items-center gap-1 overflow-hidden'>
      <span className='sr-only'>
        {t('Global cards and local methods')}: {srLabel}
      </span>
      {visible.map((m) => (
        <span
          key={m.code}
          aria-hidden='true'
          className='shrink-0 rounded bg-gray-100 px-1 py-px text-[9px] font-semibold leading-none text-gray-500'
        >
          {m.code}
        </span>
      ))}
      {rest > 0 && (
        <span
          aria-hidden='true'
          className='shrink-0 text-[9px] font-semibold leading-none text-gray-400'
        >
          +{rest}
        </span>
      )}
    </div>
  )
}
