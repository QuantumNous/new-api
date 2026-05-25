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
import { Link } from '@tanstack/react-router'
import { KeyRound, MessageSquare, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { SectionPageLayout } from '@/components/layout'

export function ChatAppPlaceholder() {
  const { t } = useTranslation()

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Chat Workspace')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t(
          'The dedicated multimodal chat app will use the same account, balance, subscription, log, and model availability system.'
        )}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <div className='border-border/70 bg-background rounded-lg border p-6 shadow-sm sm:p-8'>
          <div className='bg-primary/10 text-primary flex size-12 items-center justify-center rounded-lg'>
            <MessageSquare className='size-5' />
          </div>
          <h2 className='mt-6 text-2xl font-semibold tracking-normal'>
            {t('Chat app is being prepared')}
          </h2>
          <p className='text-muted-foreground mt-3 max-w-2xl text-sm leading-6 sm:text-base'>
            {t(
              'This route is reserved for the low-friction chat experience. The first platform phase focuses on the portal, authentication flow, and console separation.'
            )}
          </p>
          <div className='mt-6 grid gap-3 sm:grid-cols-2'>
            <div className='bg-muted/40 rounded-lg p-4'>
              <Sparkles className='text-primary size-4' />
              <p className='mt-3 text-sm font-medium'>
                {t('Future multimodal workspace')}
              </p>
              <p className='text-muted-foreground mt-1 text-sm'>
                {t('Conversations, files, images, and model selection.')}
              </p>
            </div>
            <div className='bg-muted/40 rounded-lg p-4'>
              <KeyRound className='text-primary size-4' />
              <p className='mt-3 text-sm font-medium'>
                {t('Need API access today?')}
              </p>
              <p className='text-muted-foreground mt-1 text-sm'>
                {t('Use the API console while the chat app is built out.')}
              </p>
            </div>
          </div>
          <div className='mt-6 flex flex-wrap gap-3'>
            <Button render={<Link to='/console' />}>{t('Open API Console')}</Button>
            <Button variant='outline' render={<Link to='/' />}>
              {t('Back to Portal')}
            </Button>
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

