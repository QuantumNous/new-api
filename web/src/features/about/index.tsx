import { useQuery } from '@tanstack/react-query'
import { Code, Construction } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Markdown } from '@/components/ui/markdown'
import { PublicLayout } from '@/components/layout'
import { getAboutContent } from './api'

function EmptyAboutState() {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  return (
    <div className='flex min-h-[60vh] items-center justify-center p-8'>
      <div className='max-w-2xl space-y-6 text-center'>
        <div className='flex justify-center'>
          <Construction className='text-muted-foreground h-24 w-24' />
        </div>
        <div className='space-y-2'>
          <h2 className='text-2xl font-bold'>{t('No About Content Set')}</h2>
          <p className='text-muted-foreground'>
            {t(
              'The administrator has not configured any about content yet. You can set it in the settings page, supporting HTML or URL.'
            )}
          </p>
        </div>
        <div className='space-y-4 text-sm'>
          <p>
            {t('New API Project Repository:')}{' '}
            <a
              href='https://github.com/QuantumNous/new-api'
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary hover:underline'
            >
              {t('https://github.com/QuantumNous/new-api')}
            </a>
          </p>
          <p className='text-muted-foreground'>
            <a
              href='https://github.com/QuantumNous/new-api'
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary hover:underline'
            >
              {t('NewAPI')}
            </a>{' '}
            © {currentYear}{' '}
            <a
              href='https://github.com/QuantumNous'
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary hover:underline'
            >
              {t('QuantumNous')}
            </a>{' '}
            {t('| Based on')}{' '}
            <a
              href='https://github.com/songquanpeng/one-api'
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary hover:underline'
            >
              {t('One API')}
            </a>{' '}
            © 2023{' '}
            <a
              href='https://github.com/songquanpeng'
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary hover:underline'
            >
              {t('JustSong')}
            </a>
          </p>
          <p className='text-muted-foreground'>
            {t('This project must be used in compliance with the')}{' '}
            <a
              href='https://github.com/QuantumNous/new-api/blob/main/LICENSE'
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary hover:underline'
            >
              {t('AGPL v3.0 License')}
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}

export function About() {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ['about-content'],
    queryFn: getAboutContent,
  })

  const aboutContent = data?.data || ''
  const isUrl = aboutContent.startsWith('https://')
  const trimmedContent = aboutContent.trim()
  const isHtml =
    trimmedContent.startsWith('<') ||
    trimmedContent.endsWith('>') ||
    /<\/?[a-z][\s\S]*>/i.test(trimmedContent)

  return (
    <PublicLayout showMainContainer={!isUrl}>
      {isLoading ? (
        <div className='flex min-h-[60vh] items-center justify-center'>
          <div className='flex items-center space-x-2'>
            <Code className='h-6 w-6 animate-pulse' />
            <span className='text-muted-foreground'>{t('Loading...')}</span>
          </div>
        </div>
      ) : !aboutContent ? (
        <EmptyAboutState />
      ) : isUrl ? (
        <iframe
          src={aboutContent}
          className='h-[calc(100vh-3.5rem)] w-full border-0'
          title={t('About')}
        />
      ) : isHtml ? (
        <div
          className='mx-auto max-w-6xl px-4 py-8'
          style={{ fontSize: '16px' }}
          dangerouslySetInnerHTML={{ __html: aboutContent }}
        />
      ) : (
        <div className='mx-auto max-w-6xl px-4 py-8'>
          <Markdown>{aboutContent}</Markdown>
        </div>
      )}
    </PublicLayout>
  )
}
