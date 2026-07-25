/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { BriefcaseBusiness, Mail, Share2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import { CopyButton } from '@/components/copy-button'
import { buildInvitationShareLinks } from '../lib/share'

interface ReferralLinkCardProps {
  affiliateLink: string
  loading: boolean
  error: boolean
}

export function ReferralLinkCard({
  affiliateLink,
  loading,
  error,
}: ReferralLinkCardProps) {
  const { t } = useTranslation()
  const links = buildInvitationShareLinks(
    affiliateLink,
    t(
      'Join Flatkey with my referral link. Referral rewards are processed after your first successful top-up.'
    )
  )

  return (
    <TitledCard
      title={t('Your Referral Link')}
      description={t(
        'Share your referral link with friends. Referral rewards are processed after their first successful top-up.'
      )}
      contentClassName='space-y-3'
    >
      {loading ? (
        <>
          <Skeleton className='h-9 w-full' />
          <Skeleton className='h-8 w-64 max-w-full' />
        </>
      ) : (
        <>
          <div className='flex min-w-0 gap-2'>
            <Input
              value={affiliateLink}
              readOnly
              aria-label={t('Your Referral Link')}
              className='min-w-0 flex-1 font-mono text-xs'
            />
            {affiliateLink ? (
              <CopyButton
                value={links.clipboard}
                variant='outline'
                size='default'
                tooltip={t('Copy referral link')}
                aria-label={t('Copy referral link')}
              >
                <span className='hidden sm:inline'>{t('Copy')}</span>
              </CopyButton>
            ) : null}
          </div>

          {error ? (
            <p className='text-muted-foreground text-sm'>
              {t('Failed to load')}: {t('Your Referral Link')}
            </p>
          ) : null}

          {affiliateLink ? (
            <div className='flex flex-wrap gap-2'>
              <Button
                variant='outline'
                size='icon'
                render={
                  <a
                    href={links.email}
                    aria-label={t('Share by email')}
                    title={t('Share by email')}
                  />
                }
              >
                <Mail aria-hidden='true' />
              </Button>
              <Button
                variant='outline'
                size='icon'
                render={
                  <a
                    href={links.x}
                    aria-label={t('Share on X')}
                    title={t('Share on X')}
                    target='_blank'
                    rel='noreferrer noopener'
                  />
                }
              >
                <Share2 aria-hidden='true' />
              </Button>
              <Button
                variant='outline'
                size='icon'
                render={
                  <a
                    href={links.linkedin}
                    aria-label={t('Share on LinkedIn')}
                    title={t('Share on LinkedIn')}
                    target='_blank'
                    rel='noreferrer noopener'
                  />
                }
              >
                <BriefcaseBusiness aria-hidden='true' />
              </Button>
            </div>
          ) : null}
        </>
      )}
    </TitledCard>
  )
}
