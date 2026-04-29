import { useState } from 'react'
import { Link2, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
      <Card className='overflow-hidden'>
        <CardHeader className='border-b'>
          <Skeleton className='h-6 w-32' />
          <Skeleton className='mt-2 h-4 w-48' />
        </CardHeader>
        <CardContent className='space-y-4 pt-6'>
          <Skeleton className='h-10 w-full' />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className='h-20 w-full' />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className='overflow-hidden'>
      <CardHeader className='border-b'>
        <div className='flex items-center gap-3'>
          <div className='bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg'>
            <Settings className='h-4 w-4' />
          </div>
          <div className='min-w-0'>
            <CardTitle className='text-xl tracking-tight'>
              {t('Settings')}
            </CardTitle>
            <CardDescription>
              {t('Configure your account preferences and integrations')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className='pt-6'>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className='grid h-auto w-full grid-cols-2 gap-1 rounded-xl p-1'>
            <TabsTrigger
              value='bindings'
              className='h-auto gap-2 rounded-lg px-3 py-2.5'
            >
              <Link2 className='h-4 w-4' />
              <span className='hidden sm:inline'>{t('Account Bindings')}</span>
              <span className='sm:hidden'>{t('Bindings')}</span>
            </TabsTrigger>
            <TabsTrigger
              value='settings'
              className='h-auto gap-2 rounded-lg px-3 py-2.5'
            >
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
