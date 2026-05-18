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
import { useEffect, useMemo, useState } from 'react'
import { Loader2, UserCog } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TitledCard } from '@/components/ui/titled-card'
import { updateUserSettings } from '../api'
import { parseUserSettings } from '../lib'
import type { UserProfile, UserSettings } from '../types'

type Props = {
  profile: UserProfile | null
  onProfileUpdate: () => void
}

type IndustryValue =
  | ''
  | 'education'
  | 'finance'
  | 'ecommerce'
  | 'gaming'
  | 'individual'
  | 'saas'
  | 'other'

type VolumeValue =
  | ''
  | 'trying'
  | 'daily-low'
  | 'daily-medium'
  | 'daily-high'

const INDUSTRY_OPTIONS: ReadonlyArray<{ value: IndustryValue; label: string }> = [
  { value: '', label: 'Prefer not to say' },
  { value: 'individual', label: 'Personal / hobby' },
  { value: 'education', label: 'Education / research' },
  { value: 'saas', label: 'SaaS / software product' },
  { value: 'ecommerce', label: 'E-commerce / retail' },
  { value: 'finance', label: 'Finance / fintech' },
  { value: 'gaming', label: 'Gaming / entertainment' },
  { value: 'other', label: 'Other' },
]

const VOLUME_OPTIONS: ReadonlyArray<{ value: VolumeValue; label: string }> = [
  { value: '', label: 'Prefer not to say' },
  { value: 'trying', label: 'Just trying it out' },
  { value: 'daily-low', label: 'Daily — under 1,000 requests' },
  { value: 'daily-medium', label: 'Daily — 1k to 100k requests' },
  { value: 'daily-high', label: 'Daily — over 100k requests' },
]

/**
 * Optional self-reported profile fields gathered post-signup. Used by
 * the team to prioritize models / channels / docs for whoever shows up,
 * not for billing or access — so every field has a "prefer not to say"
 * value. The wizard intentionally does NOT ask for these to keep
 * signup short; this card is the place to fill them in later.
 *
 * Marketing-emails is an explicit opt-in (default off) — required by
 * CAN-SPAM / GDPR-style rules regardless of whether we ever wire up
 * the email pipeline.
 */
export function ProfileExtensionCard({ profile, onProfileUpdate }: Props) {
  const { t } = useTranslation()

  const initial = useMemo<UserSettings>(
    () => parseUserSettings(profile?.setting),
    [profile?.setting]
  )

  const [industry, setIndustry] = useState<IndustryValue>(
    (initial.industry as IndustryValue) ?? ''
  )
  const [volume, setVolume] = useState<VolumeValue>(
    (initial.expected_volume as VolumeValue) ?? ''
  )
  const [marketingEmails, setMarketingEmails] = useState<boolean>(
    Boolean(initial.marketing_emails)
  )
  const [saving, setSaving] = useState<null | 'industry' | 'volume' | 'marketing'>(
    null
  )

  useEffect(() => {
    setIndustry((initial.industry as IndustryValue) ?? '')
    setVolume((initial.expected_volume as VolumeValue) ?? '')
    setMarketingEmails(Boolean(initial.marketing_emails))
  }, [initial.industry, initial.expected_volume, initial.marketing_emails])

  const handleIndustryChange = async (next: string | null) => {
    const nextIndustry = (next ?? '') as IndustryValue
    if (nextIndustry === industry) return
    const previous = industry
    setIndustry(nextIndustry)
    setSaving('industry')
    const res = await updateUserSettings({ industry: nextIndustry })
    setSaving(null)
    if (!res.success) {
      setIndustry(previous)
      toast.error(res.message || t('Could not save your selection.'))
      return
    }
    onProfileUpdate()
    toast.success(t('Profile updated'))
  }

  const handleVolumeChange = async (next: string | null) => {
    const nextVolume = (next ?? '') as VolumeValue
    if (nextVolume === volume) return
    const previous = volume
    setVolume(nextVolume)
    setSaving('volume')
    const res = await updateUserSettings({ expected_volume: nextVolume })
    setSaving(null)
    if (!res.success) {
      setVolume(previous)
      toast.error(res.message || t('Could not save your selection.'))
      return
    }
    onProfileUpdate()
    toast.success(t('Profile updated'))
  }

  const handleMarketingChange = async (checked: boolean) => {
    const previous = marketingEmails
    setMarketingEmails(checked)
    setSaving('marketing')
    const res = await updateUserSettings({ marketing_emails: checked })
    setSaving(null)
    if (!res.success) {
      setMarketingEmails(previous)
      toast.error(res.message || t('Could not save your selection.'))
      return
    }
    onProfileUpdate()
    toast.success(
      checked
        ? t('Subscribed — we will only email you for major updates.')
        : t('Unsubscribed from marketing emails.')
    )
  }

  return (
    <TitledCard
      icon={<UserCog className='size-4' aria-hidden='true' />}
      title={t('About you (optional)')}
      description={t(
        'Helps us prioritize the right models, docs and clients for you. Never affects billing or access.'
      )}
    >
      <div className='grid gap-4 sm:grid-cols-2'>
        <Row label={t('Industry')} saving={saving === 'industry'}>
          <Select value={industry} onValueChange={handleIndustryChange}>
            <SelectTrigger className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {INDUSTRY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value || 'none'} value={opt.value}>
                    {t(opt.label)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Row>
        <Row label={t('Expected usage')} saving={saving === 'volume'}>
          <Select value={volume} onValueChange={handleVolumeChange}>
            <SelectTrigger className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {VOLUME_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value || 'none'} value={opt.value}>
                    {t(opt.label)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Row>
      </div>

      <div className='mt-4 flex items-start gap-2 border-t pt-4'>
        <Checkbox
          id='marketing-emails'
          checked={marketingEmails}
          onCheckedChange={handleMarketingChange}
          disabled={saving === 'marketing'}
          className='mt-0.5'
        />
        <div className='flex-1'>
          <Label
            htmlFor='marketing-emails'
            className='text-sm leading-tight'
          >
            {t('Email me product updates and tips')}
          </Label>
          <p className='text-muted-foreground mt-0.5 text-xs'>
            {t(
              'Low-frequency (≤1 per month). Never used for marketing partners. Unsubscribe any time.'
            )}
          </p>
        </div>
        {saving === 'marketing' && (
          <Loader2
            className='text-muted-foreground mt-1 size-3 animate-spin'
            aria-hidden='true'
          />
        )}
      </div>
    </TitledCard>
  )
}

function Row({
  label,
  saving,
  children,
}: {
  label: string
  saving: boolean
  children: React.ReactNode
}) {
  return (
    <div className='flex flex-col gap-1.5'>
      <div className='flex items-center justify-between'>
        <label className='text-muted-foreground text-xs font-medium'>
          {label}
        </label>
        {saving && (
          <Loader2
            className='text-muted-foreground size-3 animate-spin'
            aria-hidden='true'
          />
        )}
      </div>
      {children}
    </div>
  )
}
