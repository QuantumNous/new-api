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
import { MessageCircle, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'

const QQ_GROUP_NUMBER = '1072957415'
const QQ_GROUP_JOIN_URL =
  'https://qun.qq.com/universal-share/share?ac=1&svctype=5&tempid=h5_group_info&busi_data=eyJncm91cENvZGUiOiIxMDcyOTU3NDE1In0%3D'

export function Contact() {
  const { t } = useTranslation()

  return (
    <PublicLayout>
      <div className='mx-auto max-w-3xl'>
        <div className='mb-8 text-center'>
          <h1 className='text-3xl font-bold tracking-tight'>
            {t('Contact Us')}
          </h1>
          <p className='text-muted-foreground mt-2 text-sm'>
            {t('Questions, announcements and communication are welcome.')}
          </p>
        </div>

        <div className='border-border bg-card rounded-2xl border p-8 text-center shadow-sm'>
          <div className='text-2xl' aria-hidden>
            📢 公告
          </div>
          <h2 className='mt-4 text-xl font-semibold'>
            欢迎大家加入 QQ 群！🎉
          </h2>
          <p className='text-muted-foreground mt-2 text-sm'>
            后续有问题、通知或者交流，都可以在群里进行～
          </p>

          <div className='border-border mt-8 flex flex-col items-center gap-2 rounded-xl border p-6'>
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              <Users className='h-4 w-4' />
              {t('QQ Group Number')}
            </div>
            <div className='text-2xl font-mono font-semibold tracking-widest'>
              {QQ_GROUP_NUMBER}
            </div>
            <p className='text-muted-foreground text-xs'>
              {t('Scan the QR code to join, or use the link below.')}
            </p>
            <a
              href={QQ_GROUP_JOIN_URL}
              target='_blank'
              rel='noopener noreferrer'
              className='bg-primary text-primary-foreground hover:bg-primary/90 mt-4 inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium'
            >
              <MessageCircle className='h-4 w-4' />
              {t('Join QQ Group')}
            </a>
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}
