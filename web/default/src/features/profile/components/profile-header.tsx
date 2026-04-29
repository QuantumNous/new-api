import { useTranslation } from 'react-i18next'
import { formatCompactNumber, formatQuota } from '@/lib/format'
import { getRoleLabel } from '@/lib/roles'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/status-badge'
import { getUserInitials, getDisplayName } from '../lib'
import type { UserProfile } from '../types'

// ============================================================================
// Profile Header Component
// ============================================================================

interface ProfileHeaderProps {
  profile: UserProfile | null
  loading: boolean
}

export function ProfileHeader({ profile, loading }: ProfileHeaderProps) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className='bg-card overflow-hidden rounded-2xl border'>
        <div className='p-5 sm:p-6'>
          <div className='flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between'>
            <div className='flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left'>
              <Skeleton className='h-20 w-20 rounded-2xl' />
              <div className='space-y-3'>
                <div className='flex flex-col items-center gap-2 sm:flex-row sm:justify-start'>
                  <Skeleton className='h-8 w-48' />
                  <Skeleton className='h-5 w-16' />
                </div>
                <div className='flex flex-col items-center gap-1 sm:flex-row sm:justify-start sm:gap-4'>
                  <Skeleton className='h-4 w-24' />
                  <Skeleton className='h-4 w-40' />
                  <Skeleton className='h-4 w-20' />
                </div>
              </div>
            </div>
            <div className='grid gap-3 sm:grid-cols-3 lg:w-[480px]'>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className='rounded-xl border p-4'>
                  <Skeleton className='mb-3 h-3 w-20' />
                  <Skeleton className='h-7 w-24' />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) return null

  const displayName = getDisplayName(profile)
  const initials = getUserInitials(profile)
  const roleLabel = getRoleLabel(profile.role)
  const stats = [
    {
      label: t('Current Balance'),
      value: formatQuota(profile.quota),
    },
    {
      label: t('Total Usage'),
      value: formatQuota(profile.used_quota),
    },
    {
      label: t('API Requests'),
      value: formatCompactNumber(profile.request_count),
    },
  ]

  return (
    <div className='bg-card relative overflow-hidden rounded-2xl border'>
      <div className='relative p-5 sm:p-6'>
        <div className='flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between'>
          <div className='flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left'>
            <Avatar className='ring-background h-20 w-20 rounded-2xl text-xl ring-4'>
              <AvatarFallback className='bg-primary/10 text-primary rounded-2xl'>
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className='min-w-0 flex-1 space-y-3'>
              <div className='flex flex-col items-center gap-2 sm:flex-row sm:justify-start'>
                <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>
                  {displayName}
                </h1>
                <StatusBadge
                  label={roleLabel}
                  variant='neutral'
                  copyable={false}
                />
              </div>

              <div className='text-muted-foreground flex flex-col gap-1 text-sm sm:flex-row sm:flex-wrap sm:justify-start sm:gap-4'>
                <span>@{profile.username}</span>
                {profile.email && (
                  <>
                    <span className='hidden sm:inline'>•</span>
                    <span>{profile.email}</span>
                  </>
                )}
                {profile.group && (
                  <>
                    <span className='hidden sm:inline'>•</span>
                    <span>{profile.group}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className='grid gap-3 sm:grid-cols-3 lg:w-[480px]'>
            {stats.map((item) => (
              <div
                key={item.label}
                className='bg-background/70 rounded-xl border p-4 backdrop-blur'
              >
                <p className='text-muted-foreground text-xs font-medium'>
                  {item.label}
                </p>
                <p className='mt-2 truncate text-xl font-semibold tracking-tight'>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
