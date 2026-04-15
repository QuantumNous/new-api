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
  if (loading) {
    return (
      <div className='space-y-6'>
        <div className='flex flex-col items-center gap-4 text-center lg:flex-row lg:items-center lg:gap-6 lg:text-left'>
          <Skeleton className='h-20 w-20 rounded-full' />
          <div className='flex-1 space-y-3 lg:space-y-2'>
            <div className='flex flex-col items-center gap-2 sm:flex-row sm:justify-center lg:justify-start'>
              <Skeleton className='h-8 w-48' />
              <Skeleton className='h-5 w-16' />
            </div>
            <div className='flex flex-col items-center gap-1 sm:flex-row sm:justify-center sm:gap-4 lg:justify-start'>
              <Skeleton className='h-4 w-24' />
              <Skeleton className='h-4 w-40' />
              <Skeleton className='h-4 w-20' />
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

  return (
    <div className='space-y-6'>
      <div className='flex flex-col items-center gap-4 text-center lg:flex-row lg:items-center lg:gap-6 lg:text-left'>
        <Avatar className='h-20 w-20 text-xl'>
          <AvatarFallback className='bg-primary/10 text-primary'>
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className='flex-1 space-y-3 lg:space-y-2'>
          <div className='flex flex-col items-center gap-2 sm:flex-row sm:justify-center lg:justify-start'>
            <h1 className='text-3xl font-semibold tracking-tight'>
              {displayName}
            </h1>
            <StatusBadge label={roleLabel} variant='neutral' copyable={false} />
          </div>

          <div className='text-muted-foreground flex flex-col gap-1 text-sm sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4 lg:justify-start'>
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
    </div>
  )
}
