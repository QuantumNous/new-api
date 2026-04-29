import { useState } from 'react'
import { Link2, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
      <Card>
        <CardHeader>
          <Skeleton className='h-6 w-32' />
          <Skeleton className='mt-2 h-4 w-48' />
        </CardHeader>
        <CardContent className='space-y-4'>
          <Skeleton className='h-10 w-full' />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className='h-20 w-full' />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <h3 className='text-xl font-semibold tracking-tight'>
          {t('Settings')}
        </h3>
        <p className='text-muted-foreground mt-2 text-sm'>
          {t('Configure your account preferences and integrations')}
        </p>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className='grid w-full grid-cols-2'>
            <TabsTrigger value='bindings' className='gap-2'>
              <Link2 className='h-4 w-4' />
              <span className='hidden sm:inline'>{t('Account Bindings')}</span>
              <span className='sm:hidden'>{t('Bindings')}</span>
            </TabsTrigger>
            <TabsTrigger value='settings' className='gap-2'>
              <Settings className='h-4 w-4' />
              <span className='hidden sm:inline'>
                {t('Settings & Preferences')}
              </span>
              <span className='sm:hidden'>{t('Settings')}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value='bindings' className='mt-6'>
            <AccountBindingsTab profile={profile} onUpdate={onProfileUpdate} />
          </TabsContent>

          <TabsContent value='settings' className='mt-6'>
            <NotificationTab profile={profile} onUpdate={onProfileUpdate} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
