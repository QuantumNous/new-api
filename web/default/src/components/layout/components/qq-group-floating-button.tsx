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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/context/theme-provider'
import { useSystemConfig } from '@/hooks/use-system-config'
import { CopyButton } from '@/components/copy-button'

export function QQGroupQRCodePanel() {
  const { t } = useTranslation()
  const { qqGroup, loading } = useSystemConfig()
  const { resolvedTheme } = useTheme()
  const [failedQrcodeUrl, setFailedQrcodeUrl] = useState('')

  const lightQrcodeUrl = qqGroup?.qrcodeUrlLight?.trim() ?? ''
  const darkQrcodeUrl = qqGroup?.qrcodeUrlDark?.trim() ?? ''
  const qrcodeUrl = resolvedTheme === 'dark' ? darkQrcodeUrl : lightQrcodeUrl
  const groupNumber = qqGroup?.number?.trim() ?? ''
  const shouldShow = qqGroup?.enabled === true && qrcodeUrl.length > 0
  const imageFailed = failedQrcodeUrl === qrcodeUrl

  if (loading || !shouldShow) {
    return null
  }

  return (
    <div className='w-full group-data-[collapsible=icon]:hidden'>
      <div className='text-sidebar-foreground mx-auto w-[88%] max-w-[10.75rem] overflow-hidden rounded-lg p-1'>
        <div className='grid aspect-square w-full place-items-center overflow-hidden rounded-md'>
          {imageFailed ? (
            <p className='text-muted-foreground px-2 text-center text-xs'>
              {t('QR code failed to load')}
            </p>
          ) : (
            <img
              src={qrcodeUrl}
              alt={t('QQ group QR code')}
              className='size-full object-contain'
              loading='lazy'
              onError={() => setFailedQrcodeUrl(qrcodeUrl)}
            />
          )}
        </div>

        {groupNumber ? (
          <div className='mt-1 flex min-w-0 items-center justify-center gap-1 px-1 py-0.5'>
            <p className='min-w-0 truncate text-center text-[11px] leading-4'>
              <span className='text-muted-foreground'>{t('QQ Group:')}</span>
              <span className='ml-1 font-medium text-sidebar-foreground'>
                {groupNumber}
              </span>
            </p>
            <CopyButton
              value={groupNumber}
              variant='ghost'
              size='icon'
              className='-mr-1 size-5 shrink-0 rounded text-muted-foreground hover:text-sidebar-foreground'
              tooltip={t('Copy QQ group number')}
              aria-label={t('Copy QQ group number')}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
