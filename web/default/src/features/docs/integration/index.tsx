import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DocCallout } from './components/doc-callout'
import {
  FACEAPI_BASE_URL,
  FACEAPI_BRAND,
  INTEGRATION_NAV_ITEMS,
} from './constants'

export function IntegrationHome() {
  const { t } = useTranslation()

  return (
    <div className='space-y-10'>
      <header className='space-y-4'>
        <h1 className='text-3xl font-bold tracking-tight md:text-4xl'>
          {t('FaceCloud Integration Guides')}
        </h1>
        <p className='text-muted-foreground max-w-2xl text-lg leading-relaxed'>
          {t(
            'Learn how to connect FaceCloud to popular AI coding tools and IDEs. FaceCloud acts as a unified API gateway so you can use one API key across multiple providers.'
          )}
        </p>
      </header>

      <DocCallout title={t('Before you start')}>
        {t('You need a FaceCloud API key. Create one in the dashboard, then replace')}{' '}
        <code className='bg-muted rounded px-1.5 py-0.5 font-mono text-sm'>
          sk-xxxx
        </code>{' '}
        {t('in the examples below with your real key. API base URL:')}{' '}
        <code className='bg-muted rounded px-1.5 py-0.5 font-mono text-sm'>
          {FACEAPI_BASE_URL}
        </code>
      </DocCallout>

      <div className='grid gap-4 sm:grid-cols-2'>
        {INTEGRATION_NAV_ITEMS.map((item) => {
          const Icon = item.icon

          return (
            <Link key={item.id} to={item.path} className='group block h-full'>
              <Card className='hover:border-primary/40 h-full transition-colors'>
                <CardHeader>
                  <div className='flex items-center gap-3'>
                    <div className='bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg'>
                      <Icon className='size-5' aria-hidden='true' />
                    </div>
                    <CardTitle className='text-lg'>{t(item.titleKey)}</CardTitle>
                  </div>
                  <CardDescription className='leading-relaxed'>
                    {t(item.descriptionKey)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <span className='text-primary inline-flex items-center gap-1 text-sm font-medium group-hover:underline'>
                    {t('View guide')}
                    <ArrowRight className='size-4 transition-transform group-hover:translate-x-0.5' />
                  </span>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <p className='text-muted-foreground text-sm'>
        {t('Powered by')}{' '}
        <a
          href='https://www.faceapi.ai'
          target='_blank'
          rel='noopener noreferrer'
          className='text-primary hover:underline'
        >
          {FACEAPI_BRAND}
        </a>
        . {t('For model availability and pricing, visit the pricing page or dashboard.')}
      </p>
    </div>
  )
}
