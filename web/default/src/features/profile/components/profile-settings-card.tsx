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
import { Bell, Link2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

import type { UserProfile } from '../types'
import { ProfileSectionLabel, ProfileSurface } from './profile-surface'
import { AccountBindingsTab } from './tabs/account-bindings-tab'
import { NotificationTab } from './tabs/notification-tab'

interface ProfileSettingsCardProps {
  profile: UserProfile | null
  loading: boolean
  onProfileUpdate: () => void
}

export function ProfileSettingsCard({
  profile,
  loading,
  onProfileUpdate,
}: ProfileSettingsCardProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('bindings')

  if (loading || !profile) {
    return (
      <div>
        <ProfileSectionLabel
          title={t('Account')}
          description={t('Configure your account preferences and integrations')}
        />
        <ProfileSurface padded>
          <Skeleton className='mb-4 h-10 w-full rounded-xl' />
          <div className='space-y-3'>
            {['a', 'b', 'c'].map((k) => (
              <Skeleton key={k} className='h-16 w-full rounded-xl' />
            ))}
          </div>
        </ProfileSurface>
      </div>
    )
  }

  return (
    <div>
      <ProfileSectionLabel
        title={t('Account')}
        description={t('Configure your account preferences and integrations')}
      />
      <ProfileSurface className='p-0'>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className='border-border/40 border-b px-3 pt-3 sm:px-4 sm:pt-4'>
            <TabsList className='bg-muted/40 grid h-10 w-full grid-cols-2 rounded-xl p-1'>
              <TabsTrigger
                value='bindings'
                className={cn(
                  'h-full gap-2 rounded-lg px-3 text-sm data-active:shadow-sm'
                )}
              >
                <Link2 className='size-3.5' />
                <span className='hidden sm:inline'>
                  {t('Account Bindings')}
                </span>
                <span className='sm:hidden'>{t('Bindings')}</span>
              </TabsTrigger>
              <TabsTrigger
                value='settings'
                className='h-full gap-2 rounded-lg px-3 text-sm data-active:shadow-sm'
              >
                <Bell className='size-3.5' />
                <span className='hidden sm:inline'>{t('Notifications')}</span>
                <span className='sm:hidden'>{t('Alerts')}</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className='p-4 sm:p-5'>
            <TabsContent value='bindings' className='mt-0'>
              <AccountBindingsTab
                profile={profile}
                onUpdate={onProfileUpdate}
              />
            </TabsContent>
            <TabsContent value='settings' className='mt-0'>
              <NotificationTab profile={profile} onUpdate={onProfileUpdate} />
            </TabsContent>
          </div>
        </Tabs>
      </ProfileSurface>
    </div>
  )
}
