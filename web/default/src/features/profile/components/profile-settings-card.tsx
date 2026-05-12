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
import { Link2, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TitledCard } from '@/components/ui/titled-card'
import type { UserProfile } from '../types'
import { AccountBindingsTab } from './tabs/account-bindings-tab'
import { NotificationTab } from './tabs/notification-tab'

// ============================================================================
// Profile Settings Card Component
// ============================================================================

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

  if (loading) {
    return (
      <Card className='gap-0 overflow-hidden py-0'>
        <CardHeader className='border-b p-3 !pb-3 sm:p-5 sm:!pb-5'>
          <Skeleton className='h-6 w-32' />
          <Skeleton className='mt-2 h-4 w-48' />
        </CardHeader>
        <CardContent className='space-y-4 p-3 sm:p-5'>
          <Skeleton className='h-10 w-full' />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className='h-20 w-full' />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <TitledCard
      title={t('Settings')}
      description={t('Configure your account preferences and integrations')}
      icon={<Settings className='h-4 w-4' />}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className='grid h-10 w-full grid-cols-2 items-stretch gap-1 rounded-xl p-1'>
          <TabsTrigger
            value='bindings'
            className='h-full gap-2 rounded-lg px-3 py-0 leading-none'
          >
            <Link2 className='h-4 w-4' />
            <span className='hidden sm:inline'>{t('Account Bindings')}</span>
            <span className='sm:hidden'>{t('Bindings')}</span>
          </TabsTrigger>
          <TabsTrigger
            value='settings'
            className='h-full gap-2 rounded-lg px-3 py-0 leading-none'
          >
            <Settings className='h-4 w-4' />
            <span className='hidden sm:inline'>
              {t('Settings & Preferences')}
            </span>
            <span className='sm:hidden'>{t('Settings')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value='bindings' className='mt-4 sm:mt-6'>
          <AccountBindingsTab profile={profile} onUpdate={onProfileUpdate} />
        </TabsContent>

        <TabsContent value='settings' className='mt-4 sm:mt-6'>
          <NotificationTab profile={profile} onUpdate={onProfileUpdate} />
        </TabsContent>
      </Tabs>
    </TitledCard>
  )
}
