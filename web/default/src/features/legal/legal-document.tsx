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
import { useQuery } from '@tanstack/react-query'
import { FileWarning } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PublicLayout } from '@/components/layout'
import type { LegalDocumentResponse } from './types'

type LegalDocumentProps = {
  title: string
  queryKey: string
  fetchDocument: () => Promise<LegalDocumentResponse>
  emptyMessage: string
  defaultContent?: string
}

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

function LegalMarkdown(props: { content: string }) {
  return (
    <div className='mx-auto max-w-3xl text-base leading-8 text-neutral-700 md:text-[17px] dark:text-neutral-300'>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: ({ node, ...props }) => (
            <h1
              {...props}
              className='mt-12 mb-5 text-3xl font-bold tracking-tight text-neutral-950 first:mt-0 dark:text-white'
            />
          ),
          h2: ({ node, ...props }) => (
            <h2
              {...props}
              className='mt-12 mb-4 border-t border-neutral-200 pt-8 text-2xl font-semibold tracking-tight text-neutral-950 first:mt-0 first:border-t-0 first:pt-0 dark:border-white/10 dark:text-white'
            />
          ),
          h3: ({ node, ...props }) => (
            <h3
              {...props}
              className='mt-8 mb-3 text-xl font-semibold tracking-tight text-neutral-950 dark:text-white'
            />
          ),
          p: ({ node, ...props }) => (
            <p {...props} className='my-4 leading-8 text-pretty' />
          ),
          ul: ({ node, ...props }) => (
            <ul
              {...props}
              className='my-5 list-disc space-y-2 pl-6 marker:text-violet-500'
            />
          ),
          ol: ({ node, ...props }) => (
            <ol
              {...props}
              className='my-5 list-decimal space-y-2 pl-6 marker:font-semibold marker:text-violet-500'
            />
          ),
          li: ({ node, ...props }) => <li {...props} className='pl-1' />,
          a: ({ node, ...props }) => (
            <a
              {...props}
              target='_blank'
              rel='noopener noreferrer'
              className='font-medium text-violet-700 underline underline-offset-4 dark:text-violet-300'
            />
          ),
          strong: ({ node, ...props }) => (
            <strong
              {...props}
              className='font-semibold text-neutral-950 dark:text-white'
            />
          ),
        }}
      >
        {props.content}
      </ReactMarkdown>
    </div>
  )
}

export function LegalDocument({
  title,
  queryKey,
  fetchDocument,
  emptyMessage,
  defaultContent,
}: LegalDocumentProps) {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: fetchDocument,
    staleTime: 10 * 60 * 1000,
    retry: false,
  })

  const configuredContent = data?.data?.trim() ?? ''
  const fallbackContent = defaultContent?.trim() ?? ''
  const hasConfiguredContent =
    (data?.success ?? false) && configuredContent.length > 0
  const rawContent = hasConfiguredContent ? configuredContent : fallbackContent
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
        <div className='mx-auto max-w-2xl py-12'>
          <Card className='border-dashed'>
            <CardHeader className='flex flex-row items-center gap-4'>
              <div className='bg-muted rounded-lg p-2'>
                <FileWarning className='text-muted-foreground h-5 w-5' />
              </div>
              <div className='space-y-1'>
                <CardTitle className='text-lg font-semibold'>{title}</CardTitle>
                <p className='text-muted-foreground text-sm'>
                  {data?.message || emptyMessage}
                </p>
              </div>
            </CardHeader>
          </Card>
        </div>
      </PublicLayout>
    )
  }

  if (isUrl) {
    return (
      <PublicLayout>
        <div className='mx-auto max-w-2xl py-12'>
          <Card>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'The administrator configured an external link for this document.'
                )}
              </p>
              <Button
                render={
                  <a
                    href={rawContent}
                    target='_blank'
                    rel='noopener noreferrer'
                  />
                }
              >
                {t('View document')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className='mx-auto max-w-5xl px-6 py-12 md:py-16'>
        <div className='mx-auto mb-10 max-w-3xl border-b border-neutral-200 pb-8 dark:border-white/10'>
          <h1 className='text-4xl leading-tight font-bold tracking-tight md:text-5xl'>
            {title}
          </h1>
        </div>

        {isHtml ? (
          <div
            className='prose prose-neutral dark:prose-invert mx-auto max-w-3xl'
            dangerouslySetInnerHTML={{ __html: rawContent }}
          />
        ) : (
          <LegalMarkdown content={rawContent} />
        )}
      </div>
    </PublicLayout>
  )
}
