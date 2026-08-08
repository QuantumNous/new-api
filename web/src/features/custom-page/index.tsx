import { useQuery } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Markdown } from '@/components/ui/markdown'
import { Skeleton } from '@/components/ui/skeleton'
import { PublicLayout } from '@/components/layout'
import { useStatus } from '@/hooks/use-status'
import { getCustomPageContent } from './api'

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

export function CustomPage() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const { data, isLoading } = useQuery({
    queryKey: ['custom-page-content'],
    queryFn: getCustomPageContent,
  })

  const pageTitle = (status?.CustomPageTitle as string) || t('Custom Page')

  const rawContent = data?.data?.trim() ?? ''
  const hasContent = rawContent.length > 0
  const isUrl = hasContent && isValidUrl(rawContent)
  const isHtml = hasContent && !isUrl && isLikelyHtml(rawContent)

  if (isLoading) {
    return (
      <PublicLayout>
        <div className="mx-auto flex max-w-4xl flex-col gap-4 py-12">
          <Skeleton className="h-8 w-[45%]" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[90%]" />
          <Skeleton className="h-4 w-[80%]" />
        </div>
      </PublicLayout>
    )
  }

  if (!hasContent) {
    return (
      <PublicLayout>
        <div className="flex min-h-[60vh] items-center justify-center p-8">
          <div className="max-w-2xl space-y-4 text-center">
            <div className="flex justify-center">
              <FileText className="text-muted-foreground h-20 w-20" />
            </div>
            <h2 className="text-xl font-bold">{pageTitle}</h2>
            <p className="text-muted-foreground">
              {t('The administrator has not configured this page yet.')}
            </p>
          </div>
        </div>
      </PublicLayout>
    )
  }

  if (isUrl) {
    return (
      <PublicLayout showMainContainer={false}>
        <iframe
          src={rawContent}
          className="h-[calc(100vh-3.5rem)] w-full border-0"
          title={pageTitle}
        />
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-8">
        {isHtml ? (
          <div
            className="prose prose-neutral dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: rawContent }}
          />
        ) : (
          <Markdown className="prose-neutral dark:prose-invert max-w-none">
            {rawContent}
          </Markdown>
        )}
      </div>
    </PublicLayout>
  )
}
