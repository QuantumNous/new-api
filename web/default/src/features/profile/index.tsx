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
import { useAuthStore } from '@/stores/auth-store'
import { useStatus } from '@/hooks/use-status'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CheckinCalendarCard } from './components/checkin-calendar-card'
import { LanguagePreferencesCard } from './components/language-preferences-card'
import { PasskeyCard } from './components/passkey-card'
import { ProfileSecurityCard } from './components/profile-security-card'
import { TwoFACard } from './components/two-fa-card'
import { AccountBindingsTab } from './components/tabs/account-bindings-tab'
import { useProfile } from './hooks'
import { getDisplayName, getUserInitials } from './lib'

export function Profile() {
  const { t } = useTranslation()
  const { profile, loading, refreshProfile, updateProfile, updating } =
    useProfile()
  const { status } = useStatus()
  const permissions = useAuthStore((s) => s.auth.user?.permissions)

  const checkinEnabled = status?.checkin_enabled === true
  const turnstileEnabled = !!(
    status?.turnstile_check && status?.turnstile_site_key
  )
  const turnstileSiteKey = status?.turnstile_site_key || ''
  const canConfigureSidebar = permissions?.sidebar_settings !== false

  const [displayName, setDisplayName] = useState(
    profile?.display_name || profile?.username || ''
  )

  const handleSaveProfile = async () => {
    const success = await updateProfile({ display_name: displayName })
    if (success) {
      await refreshProfile()
    }
  }

  const initials = getUserInitials(profile ?? undefined)
  const name = getDisplayName(profile ?? undefined)
  const roleLabel =
    profile?.role === 100
      ? t('Super Admin')
      : profile?.role === 10
        ? t('Admin')
        : t('User')

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>个人资料</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto w-full max-w-5xl space-y-6'>
          <div className='flex items-center gap-5'>
            <div className='bg-primary text-primary-foreground flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full text-[28px] font-semibold'>
              {initials}
            </div>
            <div>
              <h2 className='text-lg font-semibold'>{name}</h2>
              {profile && (
                <p className='text-muted-foreground mt-0.5 text-sm'>
                  {profile.email || profile.username} · {roleLabel} · {t('Registered')}{' '}
                  {new Date(profile.created_time * 1000).toLocaleDateString()}
                </p>
              )}
              <div className='mt-2 flex gap-2'>
                <Button variant='outline' size='sm' className='h-8 text-xs'>
                  Change Avatar
                </Button>
                <Button variant='ghost' size='sm' className='h-8 text-xs'>
                  Login QR Code
                </Button>
              </div>
            </div>
          </div>

          <Tabs defaultValue='basic' className='w-full'>
            <TabsList className='grid w-full grid-cols-3'>
              <TabsTrigger value='basic'>Basic Info</TabsTrigger>
              <TabsTrigger value='security'>Security</TabsTrigger>
              <TabsTrigger value='oauth'>OAuth Bindings</TabsTrigger>
            </TabsList>

            <TabsContent value='basic' className='mt-4 space-y-4'>
              <div className='bg-card rounded-[8px] border p-5 shadow-sm'>
                <h3 className='mb-4 text-sm font-semibold'>Basic Information</h3>
                <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                  <div className='space-y-1.5'>
                    <Label className='text-xs'>Username</Label>
                    <Input
                      value={profile?.username || ''}
                      readOnly
                      className='h-9 text-sm'
                    />
                  </div>
                  <div className='space-y-1.5'>
                    <Label className='text-xs'>Display Name</Label>
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className='h-9 text-sm'
                    />
                  </div>
                  <div className='space-y-1.5'>
                    <Label className='text-xs'>Email</Label>
                    <Input
                      value={profile?.email || ''}
                      readOnly
                      className='h-9 text-sm'
                    />
                  </div>
                  <div className='space-y-1.5'>
                    <Label className='text-xs'>Group</Label>
                    <Input
                      value={profile?.group || ''}
                      readOnly
                      className='h-9 text-sm'
                    />
                  </div>
                </div>
                <div className='mt-4 flex justify-end'>
                  <Button
                    size='sm'
                    onClick={handleSaveProfile}
                    disabled={updating}
                    className='h-8 text-xs'
                  >
                    {updating ? t('Saving...') : t('Save Changes')}
                  </Button>
                </div>
              </div>

              <LanguagePreferencesCard
                profile={profile}
                onProfileUpdate={refreshProfile}
              />

              {checkinEnabled && (
                <CheckinCalendarCard
                  checkinEnabled={checkinEnabled}
                  turnstileEnabled={turnstileEnabled}
                  turnstileSiteKey={turnstileSiteKey}
                />
              )}

              {canConfigureSidebar && (
                <div className='bg-card rounded-[8px] border p-5 shadow-sm'>
                  <h3 className='mb-2 text-sm font-semibold'>
                    Sidebar Settings
                  </h3>
                  <p className='text-muted-foreground text-xs'>
                    Sidebar module configuration is available in the settings
                    panel.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value='security' className='mt-4 space-y-4'>
              <ProfileSecurityCard profile={profile} loading={loading} />
              <TwoFACard loading={loading} />
              <PasskeyCard loading={loading} />
            </TabsContent>

            <TabsContent value='oauth' className='mt-4'>
              <AccountBindingsTab
                profile={profile}
                onUpdate={refreshProfile}
              />
            </TabsContent>
          </Tabs>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
