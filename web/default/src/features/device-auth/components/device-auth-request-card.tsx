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
import { Laptop } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { DeviceAuthInfo } from '../types'

export function DeviceAuthRequestCard(props: { info: DeviceAuthInfo }) {
  const { t } = useTranslation()
  return (
    <div className='flex flex-col gap-4 rounded-xl border p-5'>
      <div className='flex items-center gap-2'>
        <Laptop className='size-4' aria-hidden='true' />
        <h3 className='text-sm font-semibold'>
          {t('{{client}} wants to access your account', {
            client: props.info.client_name,
          })}
        </h3>
      </div>

      <dl className='grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm'>
        <dt className='text-muted-foreground'>{t('Sign-in code')}</dt>
        <dd className='font-mono'>{props.info.user_code}</dd>
        <dt className='text-muted-foreground'>{t('Request origin')}</dt>
        <dd>{props.info.client_ip || t('Unknown')}</dd>
      </dl>

      <div className='bg-muted/40 rounded-lg p-3'>
        <p className='text-sm font-medium'>{t('Approving will allow it to')}</p>
        <ul className='text-muted-foreground mt-1.5 list-disc space-y-1 pl-5 text-sm'>
          <li>{t('Read the models available to your account')}</li>
          <li>{t('Call models on your behalf and consume your quota')}</li>
          <li>
            {t(
              'Use a dedicated API key you can revoke any time from the API keys page'
            )}
          </li>
        </ul>
      </div>

      <p className='text-muted-foreground text-xs'>
        {t(
          'Only approve if you just started a sign-in from the desktop app and the code matches.'
        )}
      </p>
    </div>
  )
}
