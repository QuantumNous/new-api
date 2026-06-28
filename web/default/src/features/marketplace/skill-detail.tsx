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
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { ArrowLeft, Bookmark, Download, KeyRound, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SectionPageLayout } from '@/components/layout'
import {
  DownloadSkillError,
  downloadSkillPackage,
  getMarketplaceSkill,
  saveSkill,
  unsaveSkill,
} from './api'
import {
  ErrorBanner,
  KidsBadge,
  MarketplaceTrustBadges,
  PlanBadge,
  SkillPaywallDialog,
  SocialProofRow,
} from './components'

interface SkillDetailProps {
  slug: string
}

export function SkillDetail({ slug }: SkillDetailProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const href = useRouterState({ select: (s) => s.location.href })
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [paywallOpen, setPaywallOpen] = useState(false)

  const detailQuery = useQuery({
    queryKey: ['marketplace-skill', slug],
    queryFn: () => getMarketplaceSkill(slug),
  })
  const detail = detailQuery.data
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!detail) return
      if (detail.saved === true) {
        await unsaveSkill(detail.slug || detail.id, 'skill_detail')
      } else {
        await saveSkill(detail.slug || detail.id, 'skill_detail')
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['marketplace-skill', slug],
        }),
        queryClient.invalidateQueries({ queryKey: ['marketplace-skills'] }),
        queryClient.invalidateQueries({
          queryKey: ['marketplace-saved-skills'],
        }),
      ])
    },
  })

  async function handleDownload() {
    if (!detail) return
    if (detail.availability?.locked === true) {
      setPaywallOpen(true)
      return
    }
    setDownloading(true)
    setDownloadError(null)
    try {
      await downloadSkillPackage(detail.download_cta.url, detail.slug)
      toast.success(
        t('Download started. Extract the zip to .claude/skills/ to use it.')
      )
    } catch (error) {
      const code =
        error instanceof DownloadSkillError ? error.code : 'DOWNLOAD_FAILED'
      // Download AUTH_REQUIRED means the web login/session failed for this
      // download action — sign in again. It does NOT mean a missing runner
      // key (that is the DR-62 runtime client, not this page).
      if (code === 'AUTH_REQUIRED' || code === 'SKILL_AUTH_REQUIRED') {
        toast.error(t('Your session has expired. Please sign in again.'))
        useAuthStore.getState().auth.reset()
        void navigate({ to: '/sign-in', search: { redirect: href } })
        return
      }
      if (code === 'SKILL_PLAN_REQUIRED') {
        setPaywallOpen(true)
        return
      }
      if (code === 'DOWNLOAD_UNAVAILABLE') {
        setDownloadError(t('Download is unavailable for this Skill right now.'))
        return
      }
      setDownloadError(t('Download failed. Please try again.'))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {detail?.name ?? t('Skill Details')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {detail?.category ?? ''}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-4'>
          <Button
            type='button'
            size='sm'
            variant='ghost'
            className='self-start'
            onClick={() => void navigate({ to: '/skills' })}
          >
            <ArrowLeft data-icon='inline-start' />
            {t('Back to Marketplace')}
          </Button>

          {detailQuery.isLoading ? (
            <SkillDetailSkeleton />
          ) : detailQuery.isError || detail == null ? (
            <ErrorBanner
              message={
                (detailQuery.error as Error | null)?.message ??
                t('This Skill could not be loaded.')
              }
              retryable
              onRetry={() => void detailQuery.refetch()}
            />
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className='flex flex-wrap items-center gap-2'>
                    <PlanBadge plan={detail.required_plan} />
                    <MarketplaceTrustBadges badges={detail.badges} />
                    {detail.is_kids_safe === true && (
                      <KidsBadge state='kids_safe' />
                    )}
                    {detail.is_kids_exclusive === true && (
                      <KidsBadge state='kids_exclusive' />
                    )}
                  </div>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='self-start'
                    disabled={saveMutation.isPending}
                    onClick={() => saveMutation.mutate()}
                  >
                    <Bookmark
                      data-icon='inline-start'
                      className={detail.saved === true ? 'fill-current' : ''}
                    />
                    {detail.saved === true ? t('Saved') : t('Save')}
                  </Button>
                  <CardTitle>{detail.name}</CardTitle>
                  <CardDescription>
                    {detail.description ||
                      detail.short_description ||
                      t('No description provided.')}
                  </CardDescription>
                  <SocialProofRow
                    rating={detail.rating_summary}
                    downloadCount={detail.download_count}
                    className='text-sm'
                  />
                </CardHeader>
                <CardContent className='flex flex-col gap-4'>
                  {/* A1: runtime-dependency copy (R2). Always state the key
                      requirement; this is static page copy, not a runner-key
                      error. */}
                  <div className='bg-muted/40 flex gap-3 rounded-lg border p-4'>
                    <KeyRound
                      className='text-muted-foreground mt-0.5 size-5 shrink-0'
                      aria-hidden='true'
                    />
                    <div className='flex flex-col gap-1 text-sm'>
                      <span className='font-medium'>
                        {t(
                          'Running this Skill requires a DeepRouter API key; it routes its work through DeepRouter.'
                        )}
                      </span>
                      <span className='text-muted-foreground'>
                        {t(
                          'You need a DeepRouter API key to run this Skill. Sign up or add your key to continue.'
                        )}
                      </span>
                    </div>
                  </div>

                  {detail.ai_disclosure_required === true && (
                    <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                      <Sparkles
                        className='size-4 shrink-0'
                        aria-hidden='true'
                      />
                      {t('Generated by AI. Review before use.')}
                    </div>
                  )}

                  {/* A2: Download CTA in place of an Enable toggle. */}
                  <div className='flex flex-col gap-2'>
                    <Button
                      type='button'
                      className='min-w-40 self-start'
                      disabled={downloading}
                      onClick={() => void handleDownload()}
                    >
                      {detail.availability?.locked === true ? (
                        <Sparkles data-icon='inline-start' />
                      ) : (
                        <Download data-icon='inline-start' />
                      )}
                      {detail.availability?.locked === true
                        ? t('Unlock $2')
                        : downloading
                          ? t('Downloading…')
                          : t('Download')}
                    </Button>
                    {downloadError != null && (
                      <p className='text-destructive text-sm'>
                        {downloadError}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <SkillPaywallDialog
                skill={detail}
                open={paywallOpen}
                onOpenChange={setPaywallOpen}
                onContinue={() => void detailQuery.refetch()}
              />

              <Card>
                <CardHeader>
                  <CardTitle className='text-base'>
                    {t('Download and usage')}
                  </CardTitle>
                </CardHeader>
                <CardContent className='grid gap-4 md:grid-cols-2'>
                  <InstructionBlock
                    title={t('Download Instructions')}
                    body={detail.instructions.download_instructions}
                  />
                  <InstructionBlock
                    title={t('Usage Instructions')}
                    body={detail.instructions.usage_instructions}
                  />
                  <InstructionList
                    title={t('Prerequisites')}
                    items={detail.instructions.prerequisites}
                  />
                  <InstructionList
                    title={t('Quickstart')}
                    items={detail.instructions.quickstart}
                  />
                  <InstructionList
                    title={t('Example I/O')}
                    items={detail.instructions.example_io}
                  />
                </CardContent>
              </Card>

              {/* Post-download install / use hint (R2): still needs a key at
                  runtime. */}
              <Card>
                <CardHeader>
                  <CardTitle className='text-base'>
                    {t('After downloading')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className='text-muted-foreground flex list-decimal flex-col gap-1 pl-5 text-sm'>
                    <li>
                      {t('Extract the zip to your .claude/skills/ directory.')}
                    </li>
                    <li>
                      {t('Type /{{slug}} in Claude Code to use it.', {
                        slug: detail.slug,
                      })}
                    </li>
                    <li>
                      {t(
                        'Running it still requires a valid DeepRouter API key.'
                      )}
                    </li>
                  </ol>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function InstructionBlock({ title, body }: { title: string; body?: string }) {
  if (!body?.trim()) return null
  return (
    <section className='space-y-2'>
      <h3 className='text-sm font-semibold'>{title}</h3>
      <p className='text-muted-foreground text-sm whitespace-pre-wrap'>
        {body.trim()}
      </p>
    </section>
  )
}

function InstructionList({
  title,
  items,
}: {
  title: string
  items?: unknown[]
}) {
  const values = instructionItems(items)
  if (values.length === 0) return null
  return (
    <section className='space-y-2'>
      <h3 className='text-sm font-semibold'>{title}</h3>
      <ul className='text-muted-foreground list-disc space-y-1 pl-5 text-sm'>
        {values.map((value, index) => (
          <li key={`${title}-${index}`}>{value}</li>
        ))}
      </ul>
    </section>
  )
}

function instructionItems(items?: unknown[]): string[] {
  if (!Array.isArray(items)) return []
  return items
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>
        if (typeof record.text === 'string') return record.text
        if (
          typeof record.input === 'string' ||
          typeof record.output === 'string'
        ) {
          return [record.input, record.output].filter(Boolean).join(' -> ')
        }
      }
      return ''
    })
    .map((item) => item.trim())
    .filter(Boolean)
}

function SkillDetailSkeleton() {
  return (
    <Card aria-busy='true'>
      <CardHeader>
        <Skeleton className='h-5 w-24 rounded-4xl' />
        <Skeleton className='h-7 w-1/2' />
        <Skeleton className='h-4 w-3/4' />
      </CardHeader>
      <CardContent className='flex flex-col gap-4'>
        <Skeleton className='h-20 w-full' />
        <Skeleton className='h-9 w-40' />
      </CardContent>
    </Card>
  )
}
