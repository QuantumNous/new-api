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
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { Markdown } from '@/components/ui/markdown'
import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import { useHomePageContent } from './hooks'

function LauncherCard({
  to,
  icon,
  title,
  desc,
  tag,
}: {
  to: string
  icon: React.ReactNode
  title: string
  desc: string
  tag?: string
}) {
  return (
    <Link
      to={to}
      className='group block rounded-[8px] border border-border bg-card p-5 shadow-sm transition-all hover:border-primary hover:shadow-md hover:-translate-y-px'
    >
      <div className='mb-3 flex items-center gap-3'>
        <div className='flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[6px] bg-primary/10 text-primary'>
          {icon}
        </div>
        <span className='text-[15px] font-semibold'>{title}</span>
      </div>
      <p className='text-sm leading-relaxed text-muted-foreground'>{desc}</p>
      {tag && (
        <div className='mt-3 flex gap-2'>
          <span className='rounded-full bg-border/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground'>
            {tag}
          </span>
        </div>
      )}
    </Link>
  )
}

function LauncherSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className='mb-8'>
      <h2 className='mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground'>
        {title}
      </h2>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
        {children}
      </div>
    </div>
  )
}

export function Home() {
  const { t } = useTranslation()
  const { auth } = useAuthStore()
  const isAuthenticated = !!auth.user
  const { content, isLoaded, isUrl } = useHomePageContent()

  if (!isLoaded) {
    return (
      <PublicLayout showMainContainer={false}>
        <main className='flex min-h-screen items-center justify-center bg-background'>
          <div className='text-muted-foreground'>{t('Loading...')}</div>
        </main>
      </PublicLayout>
    )
  }

  if (content) {
    return (
      <PublicLayout showMainContainer={false}>
        <main className='overflow-x-hidden'>
          {isUrl ? (
            <iframe
              src={content}
              className='h-screen w-full border-none'
              title={t('Custom Home Page')}
            />
          ) : (
            <div className='container mx-auto py-8'>
              <Markdown className='custom-home-content'>{content}</Markdown>
            </div>
          )}
        </main>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout showMainContainer={false}>
      <div className='min-h-screen bg-background'>
        {/* Hero */}
        <div className='border-b border-border px-6 pb-6 pt-10 text-center'>
          <div className='mx-auto mb-4 grid h-12 w-12 place-items-center rounded-[8px] bg-primary text-xl font-bold text-primary-foreground'>
            G
          </div>
          <h1 className='mb-2 text-2xl font-semibold'>
            API Gateway · {t('Design Prototype')}
          </h1>
          <p className='mx-auto max-w-[480px] text-base text-muted-foreground'>
            {t('AI API Gateway Admin UED Prototype System')}
            <br />
            {t('Tech/Utility · High-density Data · Light/Dark Dual Theme')}
          </p>
          <div className='mt-4 flex items-center justify-center gap-3'>
            <span className='text-sm text-muted-foreground'>
              {t('Delivery Progress')}
            </span>
            <div className='h-1.5 w-[200px] overflow-hidden rounded-full bg-border'>
              <div
                className='h-full rounded-full bg-primary transition-all'
                style={{ width: '100%' }}
              />
            </div>
            <span className='font-mono text-sm text-muted-foreground'>
              20 / 20
            </span>
          </div>
        </div>

        {/* Sections */}
        <div className='mx-auto max-w-[1200px] p-6'>
          <LauncherSection title={t('Authentication')}>
            <LauncherCard
              to='/sign-in'
              icon={
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <rect x='3' y='11' width='18' height='11' rx='2' ry='2' />
                  <path d='M7 11V7a5 5 0 0110 0v4' />
                </svg>
              }
              title={t('Sign In')}
              desc={t('Password login, OAuth (GitHub/Discord), Passkey, 2FA OTP flow')}
              tag={t('Completed')}
            />
          </LauncherSection>

          <LauncherSection title={t('Personal Center')}>
            <LauncherCard
              to='/dashboard'
              icon={
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <rect x='3' y='3' width='7' height='9' rx='1' />
                  <rect x='14' y='3' width='7' height='5' rx='1' />
                  <rect x='14' y='12' width='7' height='9' rx='1' />
                  <rect x='3' y='16' width='7' height='5' rx='1' />
                </svg>
              }
              title={t('Dashboard')}
              desc={t('Stat cards, usage trends, model distribution, recent activity')}
              tag={t('Completed')}
            />
            <LauncherCard
              to='/keys'
              icon={
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <path d='M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4' />
                </svg>
              }
              title={t('API Keys')}
              desc={t('Key list, masked display, create/edit, model permissions, batch operations')}
              tag={t('Completed')}
            />
            <LauncherCard
              to='/wallet'
              icon={
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <path d='M21 12V7H5a2 2 0 010-4h14v4' />
                  <path d='M3 5v14a2 2 0 002 2h16v-5' />
                  <path d='M18 12a2 2 0 000 4h4v-4h-4z' />
                </svg>
              }
              title={t('Wallet')}
              desc={t('Balance overview, recharge presets, payment confirmation, redemption codes')}
              tag={t('Completed')}
            />
            <LauncherCard
              to='/profile'
              icon={
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <path d='M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2' />
                  <circle cx='12' cy='7' r='4' />
                </svg>
              }
              title={t('Profile')}
              desc={t('Profile edit, password management, 2FA/Passkey, OAuth binding, check-in')}
              tag={t('Completed')}
            />
            <LauncherCard
              to='/playground'
              icon={
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <path d='M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' />
                </svg>
              }
              title={t('Playground')}
              desc={t('AI model testing, parameter tuning, streaming output, multi-turn chat, reasoning display')}
              tag={t('Completed')}
            />
          </LauncherSection>

          <LauncherSection title={t('Admin')}>
            <LauncherCard
              to='/usage-logs'
              icon={
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <path d='M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z' />
                  <polyline points='14 2 14 8 20 8' />
                </svg>
              }
              title={t('Usage Logs')}
              desc={t('Call log queries, type filtering (chat/image/task), user detail dialogs')}
              tag={t('Completed')}
            />
            <LauncherCard
              to='/channels'
              icon={
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <path d='M4 6h16M4 12h16M4 18h16' />
                </svg>
              }
              title={t('Channels')}
              desc={t('Channel list, health status, response time, create/edit sheet, multi-key management')}
              tag={t('Completed')}
            />
            <LauncherCard
              to='/models'
              icon={
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <path d='M12 2L2 7l10 5 10-5-10-5z' />
                  <path d='M2 17l10 5 10-5' />
                  <path d='M2 12l10 5 10-5' />
                </svg>
              }
              title={t('Models')}
              desc={t('Model metadata, vendor management, upstream sync, pricing config')}
              tag={t('Completed')}
            />
            <LauncherCard
              to='/users'
              icon={
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <path d='M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2' />
                  <circle cx='9' cy='7' r='4' />
                </svg>
              }
              title={t('Users')}
              desc={t('User list, role management, quota adjustment, batch operations')}
              tag={t('Completed')}
            />
            <LauncherCard
              to='/redemption-codes'
              icon={
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <rect x='3' y='3' width='18' height='18' rx='2' />
                  <line x1='3' y1='9' x2='21' y2='9' />
                </svg>
              }
              title={t('Redemption Codes')}
              desc={t('Code list, batch creation, validity period, usage stats')}
              tag={t('Completed')}
            />
            <LauncherCard
              to='/subscriptions'
              icon={
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <path d='M12 20h9' />
                  <path d='M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z' />
                </svg>
              }
              title={t('Subscriptions')}
              desc={t('Plan list, create/edit, user subscription records, billing rules')}
              tag={t('Completed')}
            />
          </LauncherSection>

          <LauncherSection title={t('System Settings')}>
            <LauncherCard
              to='/system-settings/auth'
              icon={
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <rect x='3' y='11' width='18' height='11' rx='2' ry='2' />
                  <path d='M7 11V7a5 5 0 0110 0v4' />
                </svg>
              }
              title={t('Authentication')}
              desc={t('Login methods, registration toggle, OAuth config, 2FA policy')}
              tag={t('Completed')}
            />
            <LauncherCard
              to='/system-settings/site'
              icon={
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <circle cx='12' cy='12' r='10' />
                  <line x1='2' y1='12' x2='22' y2='12' />
                </svg>
              }
              title={t('Site')}
              desc={t('Site name, Logo, homepage content, Markdown editor')}
              tag={t('Completed')}
            />
            <LauncherCard
              to='/system-settings/billing'
              icon={
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <rect x='2' y='4' width='20' height='16' rx='2' />
                </svg>
              }
              title={t('Billing')}
              desc={t('Currency unit, payment gateway, invoice config, rate rules')}
              tag={t('Completed')}
            />
            <LauncherCard
              to='/system-settings/models'
              icon={
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <path d='M12 2L2 7l10 5 10-5-10-5z' />
                </svg>
              }
              title={t('Model Settings')}
              desc={t('Default model, model groups, pricing templates, quota policy')}
              tag={t('Completed')}
            />
            <LauncherCard
              to='/system-settings/content'
              icon={
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <path d='M4 6h16M4 12h16M4 18h16' />
                </svg>
              }
              title={t('Content')}
              desc={t('Default channel, load balancing, timeout config, retry policy')}
              tag={t('Completed')}
            />
            <LauncherCard
              to='/system-settings/operations'
              icon={
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <path d='M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9' />
                </svg>
              }
              title={t('Notifications')}
              desc={t('Email SMTP, Webhook, alert thresholds, notification templates')}
              tag={t('Completed')}
            />
            <LauncherCard
              to='/system-settings/operations'
              icon={
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <path d='M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z' />
                </svg>
              }
              title={t('Logs')}
              desc={t('Log retention, log level, audit policy, storage config')}
              tag={t('Completed')}
            />
            <LauncherCard
              to='/system-settings/security'
              icon={
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' />
                </svg>
              }
              title={t('Security')}
              desc={t('IP whitelist, CORS, rate limiting, access audit')}
              tag={t('Completed')}
            />
          </LauncherSection>

          <LauncherSection title={t('System Pages')}>
            <LauncherCard
              to='/404'
              icon={
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <circle cx='12' cy='12' r='10' />
                  <line x1='15' y1='9' x2='9' y2='15' />
                  <line x1='9' y1='9' x2='15' y2='15' />
                </svg>
              }
              title={t('Error Pages')}
              desc={t('401 / 403 / 404 / 500 / 503 dedicated error page designs')}
              tag={t('Completed')}
            />
          </LauncherSection>
        </div>

        {/* Footer */}
        <div className='border-t border-border px-4 py-8 text-center text-sm text-muted-foreground'>
          API Gateway Admin · 20 {t('Page Design Prototype System')} · {t('Delivered in Batches')}
        </div>
      </div>
    </PublicLayout>
  )
}
