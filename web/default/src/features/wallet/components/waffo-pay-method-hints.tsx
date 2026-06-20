/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { CreditCard } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function WaffoPayMethodHints() {
  const { t } = useTranslation()

  return (
    <div
      className='flex items-center gap-1 text-[10px] font-medium text-gray-400'
      title={t('Waffo pay methods hint')}
    >
      <CreditCard className='size-3 shrink-0' aria-hidden='true' />
      <span className='text-gray-300' aria-hidden='true'>
        ·
      </span>
      <span>Apple Pay</span>
      <span className='text-gray-300' aria-hidden='true'>
        ·
      </span>
      <span>{t('G Pay')}</span>
      <span className='sr-only'>{t('Waffo pay methods hint')}</span>
    </div>
  )
}
