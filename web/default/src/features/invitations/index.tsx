/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SectionPageLayout } from '@/components/layout'
import { InvitationFaq } from './components/invitation-faq'
import { InvitationRecordsCard } from './components/invitation-records-card'
import { InvitationRewardSummary } from './components/invitation-reward-summary'
import { InvitationStats } from './components/invitation-stats'
import { ReferralLinkCard } from './components/referral-link-card'
import { RewardStepsCard } from './components/reward-steps-card'
import { useInvitations } from './hooks/use-invitations'
import { buildAffiliateLink } from './lib/share'
import type { InvitationPageData } from './types'

export interface InvitationViewProps {
  data: InvitationPageData | null
  affiliateLink: string
  loading: boolean
  recordsLoading: boolean
  affiliateLoading: boolean
  affiliateError: boolean
  error: boolean
  page: number
  onPageChange: (page: number) => void
  onRetry: () => void
}

export function InvitationPageTitle() {
  const { t } = useTranslation()

  return (
    <span className='mx-auto block w-full max-w-7xl'>{t('Invite & Earn')}</span>
  )
}

export function InvitationView({
  data,
  affiliateLink,
  loading,
  recordsLoading,
  affiliateLoading,
  affiliateError,
  error,
  page,
  onPageChange,
  onRetry,
}: InvitationViewProps) {
  const summary = data?.summary ?? null

  return (
    <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5'>
      {(loading || summary !== null) && (
        <InvitationRewardSummary summary={summary} />
      )}
      <InvitationStats
        summary={summary}
        registeredCount={data?.total ?? 0}
        loading={loading}
      />
      <ReferralLinkCard
        affiliateLink={affiliateLink}
        loading={affiliateLoading}
        error={affiliateError}
        rewardMode={summary?.reward_mode}
      />
      {(loading || summary !== null) && <RewardStepsCard summary={summary} />}
      <InvitationRecordsCard
        data={data}
        loading={loading || recordsLoading}
        error={error}
        page={page}
        onRetry={onRetry}
        onPageChange={onPageChange}
      />
      <InvitationFaq summary={summary} />
    </div>
  )
}

export function Invitations() {
  const [page, setPage] = useState(1)
  const { invitationsQuery, codeQuery } = useInvitations(page)
  const data = invitationsQuery.data?.data ?? null
  const code = codeQuery.data?.data ?? ''
  const affiliateLink = buildAffiliateLink(code)

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        <InvitationPageTitle />
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <InvitationView
          data={data}
          affiliateLink={affiliateLink}
          loading={invitationsQuery.isLoading}
          recordsLoading={invitationsQuery.isPlaceholderData}
          affiliateLoading={codeQuery.isLoading}
          affiliateError={codeQuery.isError}
          error={invitationsQuery.isError}
          page={page}
          onPageChange={setPage}
          onRetry={() => void invitationsQuery.refetch()}
        />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
