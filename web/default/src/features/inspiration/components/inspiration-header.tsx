/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { Link } from '@tanstack/react-router'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { LanguageSwitcher } from '@/components/language-switcher'
import { HeaderLogo } from '@/components/layout'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSystemConfig } from '@/hooks/use-system-config'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Top bar of the standalone Inspiration product. It intentionally does not
 * reuse the console shell: no sidebar, no console breadcrumbs.
 */
export function InspirationHeader(props: { children?: React.ReactNode }) {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const system = useSystemConfig()

  return (
    <header className='border-border/60 bg-background/85 relative z-40 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur-xl sm:gap-3 sm:px-5'>
      <Link
        to='/'
        className='flex shrink-0 items-center gap-2'
        aria-label={t('Back to home')}
      >
        <span className='flex size-7 items-center justify-center'>
          {system.loading ? (
            <Skeleton className='size-full rounded-lg' />
          ) : (
            <HeaderLogo
              src={system.logo}
              loading={system.loading}
              logoLoaded={system.logoLoaded}
              className='size-full rounded-lg object-contain'
            />
          )}
        </span>
        <span className='hidden text-sm font-semibold tracking-tight sm:inline'>
          {system.systemName}
        </span>
      </Link>

      <span className='bg-border/70 h-5 w-px shrink-0' aria-hidden='true' />

      <Link
        to='/inspiration'
        className='flex shrink-0 items-center gap-1.5 text-sm font-semibold tracking-tight'
      >
        <Sparkles className='size-4 text-violet-500' aria-hidden='true' />
        {t('Inspiration')}
        <Badge variant='secondary' className='hidden h-5 px-1.5 sm:inline-flex'>
          {t('Preview')}
        </Badge>
      </Link>

      {props.children}

      <div className='ml-auto flex shrink-0 items-center gap-1'>
        <div className='hidden items-center gap-1 md:flex'>
          <LanguageSwitcher />
          <ThemeSwitch />
        </div>
        {user ? (
          <ProfileDropdown />
        ) : (
          <Button
            size='sm'
            variant='outline'
            className='h-8 rounded-full px-3.5 text-xs font-medium'
            render={
              <Link to='/sign-in' search={{ redirect: '/inspiration' }} />
            }
          >
            {t('Sign in')}
          </Button>
        )}
      </div>
    </header>
  )
}
