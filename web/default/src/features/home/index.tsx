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
import {
  ArrowRight,
  KeyRound,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfig } from '@/hooks/use-system-config'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'
import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import { useHomePageContent } from './hooks'

export function Home() {
  const { t } = useTranslation()
  const { auth } = useAuthStore()
  const isAuthenticated = !!auth.user
  const { content, isLoaded, isUrl } = useHomePageContent()
  const { systemName } = useSystemConfig()

  if (!isLoaded) {
    return (
      <PublicLayout showMainContainer={false}>
        <main className='flex min-h-screen items-center justify-center'>
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
      <main className='relative isolate min-h-svh overflow-hidden px-4 pt-28 pb-12 sm:px-6 lg:px-8'>
        <div
          aria-hidden
          className='bg-primary/5 absolute inset-x-0 top-0 -z-10 h-[36rem] blur-3xl'
        />
        <div
          aria-hidden
          className='absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_70%_45%_at_50%_0%,black_20%,transparent_85%)] bg-[size:4rem_4rem] opacity-[0.08]'
        />

        <section className='mx-auto flex min-h-[calc(100svh-10rem)] w-full max-w-6xl flex-col justify-center gap-10'>
          <div className='max-w-3xl'>
            <h1 className='text-4xl leading-tight font-semibold tracking-normal text-balance sm:text-5xl lg:text-6xl'>
              {systemName || t('AI Gateway Platform')}
            </h1>
            <p className='text-muted-foreground mt-5 max-w-2xl text-base leading-7 sm:text-lg'>
              {t(
                'One account for direct model chat and developer API access. Choose the workspace that matches how you want to use AI today.'
              )}
            </p>
          </div>

          <div className='grid gap-4 lg:grid-cols-2'>
            <Link
              to='/chat'
              className='group border-border/70 bg-background/80 hover:border-primary/50 focus-visible:ring-ring relative overflow-hidden rounded-lg border p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:outline-none sm:p-7'
            >
              <div className='flex items-start justify-between gap-4'>
                <div className='bg-primary/10 text-primary flex size-11 items-center justify-center rounded-lg'>
                  <MessageSquare className='size-5' />
                </div>
                <ArrowRight className='text-muted-foreground mt-1 size-5 transition-transform group-hover:translate-x-1' />
              </div>
              <h2 className='mt-8 text-2xl font-semibold tracking-normal'>
                {t('Chat Workspace')}
              </h2>
              <p className='text-muted-foreground mt-3 max-w-xl text-sm leading-6 sm:text-base'>
                {t(
                  'A low-friction multimodal workspace for conversations, files, images, and direct model interaction.'
                )}
              </p>
              <div className='text-muted-foreground mt-6 flex flex-wrap gap-3 text-xs'>
                <span className='inline-flex items-center gap-1.5'>
                  <Sparkles className='size-3.5' />
                  {t('Subscription-friendly')}
                </span>
                <span className='inline-flex items-center gap-1.5'>
                  <ShieldCheck className='size-3.5' />
                  {t('Shared account balance')}
                </span>
              </div>
            </Link>

            <Link
              to='/console'
              className='group border-border/70 bg-background/80 hover:border-primary/50 focus-visible:ring-ring relative overflow-hidden rounded-lg border p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:outline-none sm:p-7'
            >
              <div className='flex items-start justify-between gap-4'>
                <div className='bg-primary/10 text-primary flex size-11 items-center justify-center rounded-lg'>
                  <KeyRound className='size-5' />
                </div>
                <ArrowRight className='text-muted-foreground mt-1 size-5 transition-transform group-hover:translate-x-1' />
              </div>
              <h2 className='mt-8 text-2xl font-semibold tracking-normal'>
                {t('API Console')}
              </h2>
              <p className='text-muted-foreground mt-3 max-w-xl text-sm leading-6 sm:text-base'>
                {t(
                  'Manage API keys, inspect usage logs, control wallet balance, and route requests through configured upstream services.'
                )}
              </p>
              <div className='text-muted-foreground mt-6 flex flex-wrap gap-3 text-xs'>
                <span className='inline-flex items-center gap-1.5'>
                  <KeyRound className='size-3.5' />
                  {t('API key management')}
                </span>
                <span className='inline-flex items-center gap-1.5'>
                  <ShieldCheck className='size-3.5' />
                  {t('Pay-as-you-go')}
                </span>
              </div>
            </Link>
          </div>

          {!isAuthenticated && (
            <div className='flex flex-wrap items-center gap-3'>
              <Button render={<Link to='/sign-up' />}>{t('Create account')}</Button>
              <Button variant='outline' render={<Link to='/sign-in' />}>
                {t('Sign in')}
              </Button>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </PublicLayout>
  )
}
