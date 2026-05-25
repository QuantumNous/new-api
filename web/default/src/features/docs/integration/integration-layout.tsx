import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PublicLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import {
  FACEAPI_BRAND,
  FACEAPI_WEBSITE,
  INTEGRATION_HOME_PATH,
  INTEGRATION_NAV_ITEMS,
} from './constants'

function IntegrationSidebar(props: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  return (
    <nav aria-label={t('Integration guides')} className='space-y-1'>
      <Link
        to={INTEGRATION_HOME_PATH}
        onClick={props.onNavigate}
        className={cn(
          'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
          pathname === INTEGRATION_HOME_PATH
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        {t('Overview')}
      </Link>
      {INTEGRATION_NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.path

        return (
          <Link
            key={item.id}
            to={item.path}
            onClick={props.onNavigate}
            className={cn(
              'flex items-start gap-2 rounded-md px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className='mt-0.5 size-4 shrink-0' aria-hidden='true' />
            <span className='font-medium'>{t(item.titleKey)}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export function IntegrationDocsShell() {
  const { t } = useTranslation()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <PublicLayout siteName={FACEAPI_BRAND} showMainContainer={false}>
      <div className='border-border bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-14 z-30 border-b backdrop-blur lg:hidden'>
        <div className='container flex items-center justify-between px-4 py-3'>
          <div>
            <p className='text-sm font-semibold'>{FACEAPI_BRAND}</p>
            <p className='text-muted-foreground text-xs'>{t('Integration')}</p>
          </div>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant='outline' size='icon' aria-label={t('Open menu')}>
                <Menu className='size-4' />
              </Button>
            </SheetTrigger>
            <SheetContent side='left' className='w-[280px]'>
              <SheetHeader>
                <SheetTitle>{t('Integration guides')}</SheetTitle>
              </SheetHeader>
              <div className='mt-6'>
                <IntegrationSidebar onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className='container px-4 pb-16 pt-20 lg:pt-24'>
        <div className='mx-auto flex max-w-6xl gap-10'>
          <aside className='hidden w-56 shrink-0 lg:block'>
            <div className='sticky top-24 space-y-6'>
              <div>
                <p className='text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase'>
                  {FACEAPI_BRAND}
                </p>
                <h2 className='text-lg font-semibold'>{t('Integration')}</h2>
                <a
                  href={FACEAPI_WEBSITE}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary mt-1 inline-block text-sm hover:underline'
                >
                  {FACEAPI_WEBSITE}
                </a>
              </div>
              <IntegrationSidebar />
            </div>
          </aside>

          <main className='min-w-0 flex-1'>
            <Outlet />
          </main>
        </div>
      </div>
    </PublicLayout>
  )
}
