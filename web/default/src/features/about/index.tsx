import { useQuery } from '@tanstack/react-query'
import { Construction } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Markdown } from '@/components/ui/markdown'
import { Skeleton } from '@/components/ui/skeleton'
import { PublicLayout } from '@/components/layout'
import { getAboutContent } from './api'

function isValidUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function isLikelyHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

function EmptyAboutState() {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  return (
    <div className='flex min-h-[60vh] items-center justify-center p-8'>
      <div className='max-w-2xl space-y-6 text-center'>
        <div className='flex justify-center'>
          <img src='/logo.png' alt='AIKanHub' className='h-24 w-24 object-contain' />
        </div>
        <div className='space-y-2'>
          <h2 className='text-2xl font-bold'>AIKanHub</h2>
          <p className='text-muted-foreground'>
            {t('A unified video generation API gateway. One key, all major models.')}
          </p>
        </div>
        <div className='space-y-3 text-sm'>
          <p>
            <a
              href='https://github.com/NekoAIKan/aikanhub'
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary hover:underline'
            >
              github.com/NekoAIKan/aikanhub
            </a>
          </p>
          <p className='text-muted-foreground/80'>
            © {currentYear} AIKanHub · forked from{' '}
            <a
              href='https://github.com/Calcium-Ion/new-api'
              target='_blank'
              rel='noopener noreferrer'
              className='hover:underline'
            >
              new-api
            </a>{' '}
            (originally{' '}
            <a
              href='https://github.com/songquanpeng/one-api'
              target='_blank'
              rel='noopener noreferrer'
              className='hover:underline'
            >
              one-api
            </a>
            )
          </p>
          <p className='text-muted-foreground/80'>
            {t('Licensed under')}{' '}
            <a
              href='https://github.com/NekoAIKan/aikanhub/blob/main/LICENSE'
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary hover:underline'
            >
              AGPL v3.0
            </a>
            . {t('See')}{' '}
            <a
              href='https://github.com/NekoAIKan/aikanhub/blob/main/NOTICE.md'
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary hover:underline'
            >
              NOTICE
            </a>{' '}
            {t('for full attribution.')}
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

  const rawContent = data?.data?.trim() ?? ''
  const hasContent = rawContent.length > 0
  const isUrl = hasContent && isValidUrl(rawContent)
  const isHtml = hasContent && !isUrl && isLikelyHtml(rawContent)

  if (isLoading) {
    return (
      <PublicLayout>
        <div className='mx-auto flex max-w-4xl flex-col gap-4 py-12'>
          <Skeleton className='h-8 w-[45%]' />
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-[90%]' />
          <Skeleton className='h-4 w-[80%]' />
        </div>
      </PublicLayout>
    )
  }

  if (!hasContent) {
    return (
      <PublicLayout>
        <EmptyAboutState />
      </PublicLayout>
    )
  }

  if (isUrl) {
    return (
      <PublicLayout showMainContainer={false}>
        <iframe
          src={rawContent}
          className='h-[calc(100vh-3.5rem)] w-full border-0'
          title={t('About')}
        />
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className='mx-auto max-w-6xl px-4 py-8'>
        {isHtml ? (
          <div
            className='prose prose-neutral dark:prose-invert max-w-none'
            dangerouslySetInnerHTML={{ __html: rawContent }}
          />
        ) : (
          <Markdown className='prose-neutral dark:prose-invert max-w-none'>
            {rawContent}
          </Markdown>
        )}
      </div>
    </PublicLayout>
  )
}
