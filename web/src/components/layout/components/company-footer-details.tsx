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
import { useTranslation } from 'react-i18next'

export function CompanyFooterDetails() {
  const { t } = useTranslation()

  return (
    <div className='text-muted-foreground mt-6 flex flex-col items-center gap-3 text-center text-xs leading-6 sm:items-end sm:text-right'>
      <address className='not-italic'>
        <span>{t('Office address')}: </span>
        <span>深圳市宝安区航城街道九围社区丁圳路11号顺兴管理处</span>
      </address>
      <div className='flex flex-col items-center gap-1 sm:items-end'>
        <a href='tel:18688669114' className='hover:text-foreground'>
          {t('Contact phone')}: 18688669114
        </a>
        <a
          href='mailto:support@tokeninfra.com'
          className='hover:text-foreground'
        >
          {t('Email')}: support@tokeninfra.com
        </a>
      </div>
    </div>
  )
}
