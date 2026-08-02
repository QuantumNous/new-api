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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RotateCcw, Search } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  formatTimestampToDate,
  parseQuotaFromCNY,
  quotaUnitsToCNY,
} from '@/lib/format'

import {
  deleteAffiliateUserOverride,
  getAffiliateSettings,
  searchAffiliateUserOverrides,
  updateAffiliateSettings,
  updateAffiliateUserOverride,
} from '../api'
import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import type {
  AffiliateCashbackFrequency,
  AffiliateRegistrationRewardTrigger,
  AffiliateRewardMode,
  AffiliateSettings,
  AffiliateUserOverride,
  AffiliateUserOverrideView,
} from '../types'
import { AffiliateAdjustmentsSection } from './affiliate-adjustments-section'
import { AffiliateCampaignSettings } from './affiliate-campaign-settings'

const SECONDS_PER_DAY = 86_400

type RuleFieldKey = keyof AffiliateSettings

type RuleDraft = {
  enabled: boolean
  inviterReward: string
  inviteeReward: string
  registrationRewardTrigger: AffiliateRegistrationRewardTrigger
  rewardMode: AffiliateRewardMode
  cashbackFrequency: AffiliateCashbackFrequency
  rewardRate: string
  fixedReward: string
  unlimitedReward: boolean
  maximumReward: string
  minimumTopUp: string
  holdDays: string
  minimumTransfer: string
  showInviteeTopUps: boolean
}

const ruleFieldKeys: RuleFieldKey[] = [
  'enabled',
  'inviter_reward_quota',
  'invitee_reward_quota',
  'registration_reward_trigger',
  'reward_mode',
  'cashback_frequency',
  'reward_rate_bps',
  'fixed_reward_quota',
  'unlimited_reward',
  'maximum_reward_quota',
  'minimum_topup_cents',
  'hold_seconds',
  'minimum_transfer_quota',
  'show_invitee_topups',
]

function settingsToDraft(settings: AffiliateSettings): RuleDraft {
  return {
    enabled: settings.enabled,
    inviterReward: String(quotaUnitsToCNY(settings.inviter_reward_quota)),
    inviteeReward: String(quotaUnitsToCNY(settings.invitee_reward_quota)),
    registrationRewardTrigger: settings.registration_reward_trigger,
    rewardMode: settings.reward_mode,
    cashbackFrequency: settings.cashback_frequency,
    rewardRate: String(settings.reward_rate_bps / 100),
    fixedReward: String(quotaUnitsToCNY(settings.fixed_reward_quota)),
    unlimitedReward: settings.unlimited_reward,
    maximumReward: String(quotaUnitsToCNY(settings.maximum_reward_quota)),
    minimumTopUp: String(settings.minimum_topup_cents / 100),
    holdDays: String(settings.hold_seconds / SECONDS_PER_DAY),
    minimumTransfer: String(quotaUnitsToCNY(settings.minimum_transfer_quota)),
    showInviteeTopUps: settings.show_invitee_topups,
  }
}

function draftToSettings(draft: RuleDraft): AffiliateSettings | null {
  const rewardRate = Number(draft.rewardRate)
  const minimumTopUp = Number(draft.minimumTopUp)
  const holdDays = Number(draft.holdDays)
  const quotaAmounts = [
    draft.inviterReward,
    draft.inviteeReward,
    draft.fixedReward,
    draft.maximumReward,
    draft.minimumTransfer,
  ].map(Number)
  if (
    !Number.isFinite(rewardRate) ||
    rewardRate < 0 ||
    rewardRate > 100 ||
    !Number.isFinite(minimumTopUp) ||
    minimumTopUp < 0 ||
    !Number.isInteger(holdDays) ||
    holdDays < 0 ||
    holdDays > 365 ||
    quotaAmounts.some((amount) => !Number.isFinite(amount) || amount < 0) ||
    (!draft.unlimitedReward && Number(draft.maximumReward) <= 0)
  ) {
    return null
  }
  return {
    enabled: draft.enabled,
    inviter_reward_quota: parseQuotaFromCNY(Number(draft.inviterReward)),
    invitee_reward_quota: parseQuotaFromCNY(Number(draft.inviteeReward)),
    registration_reward_trigger: draft.registrationRewardTrigger,
    reward_mode: draft.rewardMode,
    cashback_frequency: draft.cashbackFrequency,
    reward_rate_bps: Math.round(rewardRate * 100),
    fixed_reward_quota: parseQuotaFromCNY(Number(draft.fixedReward)),
    unlimited_reward: draft.unlimitedReward,
    maximum_reward_quota: parseQuotaFromCNY(Number(draft.maximumReward)),
    minimum_topup_cents: Math.round(minimumTopUp * 100),
    hold_seconds: holdDays * SECONDS_PER_DAY,
    minimum_transfer_quota: parseQuotaFromCNY(Number(draft.minimumTransfer)),
    show_invitee_topups: draft.showInviteeTopUps,
  }
}

interface RuleEditorProps {
  draft: RuleDraft
  onChange: (draft: RuleDraft) => void
  following?: Record<RuleFieldKey, boolean>
  onFollowingChange?: (key: RuleFieldKey, following: boolean) => void
  disabled?: boolean
}

function RuleEditor(props: RuleEditorProps) {
  const { t } = useTranslation()
  const update = <K extends keyof RuleDraft>(key: K, value: RuleDraft[K]) =>
    props.onChange({ ...props.draft, [key]: value })
  const isDisabled = (key: RuleFieldKey) =>
    props.disabled || props.following?.[key] === true

  function ruleField(
    key: RuleFieldKey,
    label: string,
    content: ReactNode,
    description?: string
  ) {
    const following = props.following?.[key]
    return (
      <Field key={key} data-disabled={isDisabled(key)}>
        <div className='flex min-h-5 items-center justify-between gap-3'>
          <FieldLabel>{label}</FieldLabel>
          {following !== undefined ? (
            <label className='text-muted-foreground flex items-center gap-2 text-xs'>
              {t('Follow global')}
              <Switch
                checked={following}
                onCheckedChange={(checked) =>
                  props.onFollowingChange?.(key, checked)
                }
                disabled={props.disabled}
              />
            </label>
          ) : null}
        </div>
        {content}
        {description ? (
          <FieldDescription>{description}</FieldDescription>
        ) : null}
      </Field>
    )
  }

  return (
    <FieldGroup className='grid gap-5 md:grid-cols-2'>
      {ruleField(
        'enabled',
        t('Enable referral cashback'),
        <Switch
          checked={props.draft.enabled}
          onCheckedChange={(checked) => update('enabled', checked)}
          disabled={isDisabled('enabled')}
        />,
        t('The invitation code remains valid when rewards are disabled.')
      )}
      {ruleField(
        'registration_reward_trigger',
        t('Registration reward timing'),
        <ToggleGroup
          value={[props.draft.registrationRewardTrigger]}
          onValueChange={(values) => {
            const next = values[0] as AffiliateRegistrationRewardTrigger
            if (next) update('registrationRewardTrigger', next)
          }}
          disabled={isDisabled('registration_reward_trigger')}
          className='grid w-full grid-cols-2'
        >
          <ToggleGroupItem value='registration_success' className='w-full'>
            {t('After registration')}
          </ToggleGroupItem>
          <ToggleGroupItem value='first_qualified_topup' className='w-full'>
            {t('After first qualification')}
          </ToggleGroupItem>
        </ToggleGroup>
      )}
      {ruleField(
        'inviter_reward_quota',
        t('Inviter reward'),
        <InputGroup>
          <InputGroupInput
            type='number'
            min={0}
            step='0.01'
            value={props.draft.inviterReward}
            onChange={(event) => update('inviterReward', event.target.value)}
            disabled={isDisabled('inviter_reward_quota')}
          />
          <InputGroupAddon align='inline-end'>
            <InputGroupText>{t('CNY')}</InputGroupText>
          </InputGroupAddon>
        </InputGroup>,
        t('The inviter reward uses the same hold period as cashback.')
      )}
      {ruleField(
        'invitee_reward_quota',
        t('Invitee reward'),
        <InputGroup>
          <InputGroupInput
            type='number'
            min={0}
            step='0.01'
            value={props.draft.inviteeReward}
            onChange={(event) => update('inviteeReward', event.target.value)}
            disabled={isDisabled('invitee_reward_quota')}
          />
          <InputGroupAddon align='inline-end'>
            <InputGroupText>{t('CNY')}</InputGroupText>
          </InputGroupAddon>
        </InputGroup>,
        t('The invitee reward is credited directly to account balance.')
      )}
      {ruleField(
        'cashback_frequency',
        t('Cashback frequency'),
        <ToggleGroup
          value={[props.draft.cashbackFrequency]}
          onValueChange={(values) => {
            const next = values[0] as AffiliateCashbackFrequency
            if (next) update('cashbackFrequency', next)
          }}
          disabled={isDisabled('cashback_frequency')}
          className='grid w-full grid-cols-2'
        >
          <ToggleGroupItem value='first_qualified' className='w-full'>
            {t('First qualification only')}
          </ToggleGroupItem>
          <ToggleGroupItem value='every_topup' className='w-full'>
            {t('Every top-up')}
          </ToggleGroupItem>
        </ToggleGroup>
      )}
      {ruleField(
        'reward_mode',
        t('Cashback method'),
        <ToggleGroup
          value={[props.draft.rewardMode]}
          onValueChange={(values) => {
            const next = values[0] as AffiliateRewardMode
            if (next) update('rewardMode', next)
          }}
          disabled={isDisabled('reward_mode')}
          className='grid w-full grid-cols-2'
        >
          <ToggleGroupItem value='percentage' className='w-full'>
            {t('Percentage')}
          </ToggleGroupItem>
          <ToggleGroupItem value='fixed' className='w-full'>
            {t('Fixed amount')}
          </ToggleGroupItem>
        </ToggleGroup>
      )}
      {props.draft.rewardMode === 'percentage'
        ? ruleField(
            'reward_rate_bps',
            t('Cashback rate'),
            <InputGroup>
              <InputGroupInput
                type='number'
                min={0}
                max={100}
                step='0.01'
                value={props.draft.rewardRate}
                onChange={(event) => update('rewardRate', event.target.value)}
                disabled={isDisabled('reward_rate_bps')}
              />
              <InputGroupAddon align='inline-end'>
                <InputGroupText>%</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          )
        : ruleField(
            'fixed_reward_quota',
            t('Fixed cashback'),
            <InputGroup>
              <InputGroupInput
                type='number'
                min={0}
                step='0.01'
                value={props.draft.fixedReward}
                onChange={(event) => update('fixedReward', event.target.value)}
                disabled={isDisabled('fixed_reward_quota')}
              />
              <InputGroupAddon align='inline-end'>
                <InputGroupText>{t('CNY')}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          )}
      {ruleField(
        'minimum_topup_cents',
        t('First qualifying cumulative top-up'),
        <InputGroup>
          <InputGroupInput
            type='number'
            min={0}
            step='0.01'
            value={props.draft.minimumTopUp}
            onChange={(event) => update('minimumTopUp', event.target.value)}
            disabled={isDisabled('minimum_topup_cents')}
          />
          <InputGroupAddon align='inline-end'>
            <InputGroupText>{t('CNY')}</InputGroupText>
          </InputGroupAddon>
        </InputGroup>,
        t('After qualification, later top-ups have no minimum amount.')
      )}
      {ruleField(
        'unlimited_reward',
        t('Unlimited cashback per invitee'),
        <Switch
          checked={props.draft.unlimitedReward}
          onCheckedChange={(checked) => update('unlimitedReward', checked)}
          disabled={isDisabled('unlimited_reward')}
        />
      )}
      {!props.draft.unlimitedReward
        ? ruleField(
            'maximum_reward_quota',
            t('Maximum cashback per invitee'),
            <InputGroup>
              <InputGroupInput
                type='number'
                min={0.01}
                step='0.01'
                value={props.draft.maximumReward}
                onChange={(event) =>
                  update('maximumReward', event.target.value)
                }
                disabled={isDisabled('maximum_reward_quota')}
              />
              <InputGroupAddon align='inline-end'>
                <InputGroupText>{t('CNY')}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          )
        : null}
      {ruleField(
        'hold_seconds',
        t('Hold period'),
        <InputGroup>
          <InputGroupInput
            type='number'
            min={0}
            max={365}
            step={1}
            value={props.draft.holdDays}
            onChange={(event) => update('holdDays', event.target.value)}
            disabled={isDisabled('hold_seconds')}
          />
          <InputGroupAddon align='inline-end'>
            <InputGroupText>{t('Days')}</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      )}
      {ruleField(
        'minimum_transfer_quota',
        t('Minimum balance transfer'),
        <InputGroup>
          <InputGroupInput
            type='number'
            min={0}
            step='0.01'
            value={props.draft.minimumTransfer}
            onChange={(event) => update('minimumTransfer', event.target.value)}
            disabled={isDisabled('minimum_transfer_quota')}
          />
          <InputGroupAddon align='inline-end'>
            <InputGroupText>{t('CNY')}</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      )}
      {ruleField(
        'show_invitee_topups',
        t('Allow invitee top-up records'),
        <Switch
          checked={props.draft.showInviteeTopUps}
          onCheckedChange={(checked) => update('showInviteeTopUps', checked)}
          disabled={isDisabled('show_invitee_topups')}
        />,
        t('Emails are masked before records are returned to the inviter.')
      )}
    </FieldGroup>
  )
}

function GlobalAffiliateSettings() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['admin', 'affiliate', 'settings'],
    queryFn: getAffiliateSettings,
    select: (response) => response.data,
  })
  const [draft, setDraft] = useState<RuleDraft>()
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    if (!query.data) return
    setDraft(settingsToDraft(query.data))
    setDirty(false)
  }, [query.data])
  const mutation = useMutation({
    mutationFn: updateAffiliateSettings,
    onSuccess: async (response) => {
      if (!response.success || !response.data) return
      toast.success(t('Referral cashback settings saved'))
      setDraft(settingsToDraft(response.data))
      setDirty(false)
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'affiliate'],
      })
    },
  })

  function submit(event?: FormEvent) {
    event?.preventDefault()
    if (!draft) return
    const settings = draftToSettings(draft)
    if (!settings) {
      toast.error(t('Check the cashback settings and try again'))
      return
    }
    mutation.mutate(settings)
  }

  if (!draft) {
    return <Spinner className='mx-auto my-12' />
  }

  return (
    <SettingsForm onSubmit={submit} autoComplete='off'>
      <SettingsPageFormActions
        onSave={() => submit()}
        isSaving={mutation.isPending}
        isSaveDisabled={!dirty}
        saveLabel='Save referral cashback settings'
      />
      <RuleEditor
        draft={draft}
        onChange={(next) => {
          setDraft(next)
          setDirty(true)
        }}
        disabled={mutation.isPending}
      />
    </SettingsForm>
  )
}

function PersonalizedAffiliateSettings() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [selected, setSelected] = useState<AffiliateUserOverrideView>()
  const [draft, setDraft] = useState<RuleDraft>()
  const [following, setFollowing] = useState<Record<RuleFieldKey, boolean>>()
  const [changeReason, setChangeReason] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const query = useQuery({
    queryKey: ['admin', 'affiliate', 'user-overrides', keyword],
    queryFn: () => searchAffiliateUserOverrides(keyword),
    select: (response) => response.data?.items ?? [],
    enabled: keyword.length > 0,
  })

  function selectUser(view: AffiliateUserOverrideView) {
    const follow = {} as Record<RuleFieldKey, boolean>
    for (const key of ruleFieldKeys) {
      follow[key] = view.override?.[key] == null
    }
    setSelected(view)
    setDraft(settingsToDraft(view.effective_rule))
    setFollowing(follow)
    setChangeReason('')
  }

  const saveMutation = useMutation({
    mutationFn: (request: {
      userId: number
      override: AffiliateUserOverride
    }) => updateAffiliateUserOverride(request.userId, request.override),
    onSuccess: async (response) => {
      if (!response.success || !response.data) return
      toast.success(t('User-specific cashback settings saved'))
      selectUser(response.data)
      setConfirmOpen(false)
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'affiliate', 'user-overrides'],
      })
    },
  })
  const resetMutation = useMutation({
    mutationFn: (userId: number) => deleteAffiliateUserOverride(userId),
    onSuccess: async (response) => {
      if (!response.success || !selected) return
      toast.success(t('User now follows global cashback settings'))
      selectUser({
        ...selected,
        override: null,
        effective_rule: selected.global_rule,
      })
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'affiliate', 'user-overrides'],
      })
    },
  })

  function buildOverride(): AffiliateUserOverride | null {
    if (!draft || !following) return null
    const settings = draftToSettings(draft)
    if (!settings || !changeReason.trim()) return null
    return {
      enabled: following.enabled ? null : settings.enabled,
      inviter_reward_quota: following.inviter_reward_quota
        ? null
        : settings.inviter_reward_quota,
      invitee_reward_quota: following.invitee_reward_quota
        ? null
        : settings.invitee_reward_quota,
      registration_reward_trigger: following.registration_reward_trigger
        ? null
        : settings.registration_reward_trigger,
      reward_mode: following.reward_mode ? null : settings.reward_mode,
      cashback_frequency: following.cashback_frequency
        ? null
        : settings.cashback_frequency,
      reward_rate_bps: following.reward_rate_bps
        ? null
        : settings.reward_rate_bps,
      fixed_reward_quota: following.fixed_reward_quota
        ? null
        : settings.fixed_reward_quota,
      unlimited_reward: following.unlimited_reward
        ? null
        : settings.unlimited_reward,
      maximum_reward_quota: following.maximum_reward_quota
        ? null
        : settings.maximum_reward_quota,
      minimum_topup_cents: following.minimum_topup_cents
        ? null
        : settings.minimum_topup_cents,
      hold_seconds: following.hold_seconds ? null : settings.hold_seconds,
      minimum_transfer_quota: following.minimum_transfer_quota
        ? null
        : settings.minimum_transfer_quota,
      show_invitee_topups: following.show_invitee_topups
        ? null
        : settings.show_invitee_topups,
      change_reason: changeReason.trim(),
    }
  }

  const overriddenKeys = following
    ? ruleFieldKeys.filter((key) => !following[key])
    : []
  const fieldLabels: Record<RuleFieldKey, string> = {
    enabled: t('Enable referral cashback'),
    inviter_reward_quota: t('Inviter reward'),
    invitee_reward_quota: t('Invitee reward'),
    registration_reward_trigger: t('Registration reward timing'),
    reward_mode: t('Cashback method'),
    cashback_frequency: t('Cashback frequency'),
    reward_rate_bps: t('Cashback rate'),
    fixed_reward_quota: t('Fixed cashback'),
    unlimited_reward: t('Unlimited cashback per invitee'),
    maximum_reward_quota: t('Maximum cashback per invitee'),
    minimum_topup_cents: t('First qualifying cumulative top-up'),
    hold_seconds: t('Hold period'),
    minimum_transfer_quota: t('Minimum balance transfer'),
    show_invitee_topups: t('Allow invitee top-up records'),
  }

  return (
    <div className='grid gap-6'>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          setKeyword(searchInput.trim())
        }}
      >
        <Field>
          <FieldLabel htmlFor='affiliate-user-search'>
            {t('Search user')}
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              id='affiliate-user-search'
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('Username, email, or user ID')}
            />
            <InputGroupAddon align='inline-end'>
              <InputGroupButton type='submit' aria-label={t('Search')}>
                <Search />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
      </form>

      {keyword ? (
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('User')}</TableHead>
                <TableHead>{t('Email')}</TableHead>
                <TableHead>{t('Configuration')}</TableHead>
                <TableHead className='text-right'>{t('Action')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(query.data ?? []).map((view) => (
                <TableRow key={view.user_id}>
                  <TableCell className='font-medium'>
                    {view.username}{' '}
                    <span className='text-muted-foreground'>
                      #{view.user_id}
                    </span>
                  </TableCell>
                  <TableCell>{view.email || '-'}</TableCell>
                  <TableCell>
                    <Badge variant='outline'>
                      {view.override ? t('Customized') : t('Follows global')}
                    </Badge>
                  </TableCell>
                  <TableCell className='text-right'>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      onClick={() => selectUser(view)}
                    >
                      {t('Configure')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!query.isLoading && (query.data?.length ?? 0) === 0 ? (
            <Empty className='min-h-40'>
              <EmptyHeader>
                <EmptyTitle>{t('No matching users')}</EmptyTitle>
                <EmptyDescription>
                  {t('Try another username, email, or user ID.')}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
        </div>
      ) : null}

      {selected && draft && following ? (
        <div className='grid gap-5'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <h3 className='text-sm font-semibold'>
                {selected.username} #{selected.user_id}
              </h3>
              <p className='text-muted-foreground text-xs'>
                {t('{{count}} fields currently override global settings', {
                  count: overriddenKeys.length,
                })}
              </p>
            </div>
            <Button
              type='button'
              variant='outline'
              disabled={!selected.override || resetMutation.isPending}
              onClick={() => resetMutation.mutate(selected.user_id)}
            >
              <RotateCcw data-icon='inline-start' />
              {t('Follow all global settings')}
            </Button>
          </div>
          <RuleEditor
            draft={draft}
            onChange={setDraft}
            following={following}
            onFollowingChange={(key, value) =>
              setFollowing({ ...following, [key]: value })
            }
            disabled={saveMutation.isPending || resetMutation.isPending}
          />
          {selected.override ? (
            <div className='border-border grid gap-3 border-y py-3 text-xs sm:grid-cols-3'>
              <div>
                <div className='text-muted-foreground'>
                  {t('Last modified by')}
                </div>
                <div className='mt-1 font-medium'>
                  {selected.updated_by_username || t('User')} #
                  {selected.override.updated_by ?? '-'}
                </div>
              </div>
              <div>
                <div className='text-muted-foreground'>
                  {t('Last modified at')}
                </div>
                <div className='mt-1 font-medium'>
                  {formatTimestampToDate(selected.override.updated_at ?? 0)}
                </div>
              </div>
              <div>
                <div className='text-muted-foreground'>
                  {t('Change reason')}
                </div>
                <div className='mt-1 font-medium wrap-break-word'>
                  {selected.override.change_reason}
                </div>
              </div>
            </div>
          ) : null}
          <Field>
            <FieldLabel htmlFor='affiliate-change-reason'>
              {t('Change reason')}
            </FieldLabel>
            <Textarea
              id='affiliate-change-reason'
              value={changeReason}
              maxLength={500}
              onChange={(event) => setChangeReason(event.target.value)}
              placeholder={t('Required for audit history')}
            />
          </Field>
          <div className='flex justify-end'>
            <Button
              type='button'
              disabled={saveMutation.isPending || !changeReason.trim()}
              onClick={() => {
                if (!buildOverride()) {
                  toast.error(t('Check the cashback settings and try again'))
                  return
                }
                setConfirmOpen(true)
              }}
            >
              {saveMutation.isPending ? (
                <Spinner data-icon='inline-start' />
              ) : null}
              {t('Save user-specific settings')}
            </Button>
          </div>
        </div>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('Apply user-specific settings?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'The new rule applies to future reward events for all existing and future invitees. Existing rewards and unlock times will not be recalculated.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className='flex flex-wrap gap-1.5'>
            {overriddenKeys.map((key) => (
              <Badge key={key} variant='secondary'>
                {fieldLabels[key]}
              </Badge>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const request = buildOverride()
                if (request && selected) {
                  saveMutation.mutate({
                    userId: selected.user_id,
                    override: request,
                  })
                }
              }}
            >
              {t('Confirm and save')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function AffiliateSettingsSection() {
  const { t } = useTranslation()
  return (
    <SettingsSection title={t('Referral Cashback')}>
      <Tabs defaultValue='global'>
        <TabsList className='grid w-full max-w-3xl grid-cols-4'>
          <TabsTrigger
            value='campaign'
            className='h-auto min-h-9 py-2 text-center leading-tight whitespace-normal'
          >
            {t('Campaign')}
          </TabsTrigger>
          <TabsTrigger
            value='global'
            className='h-auto min-h-9 py-2 text-center leading-tight whitespace-normal'
          >
            {t('Global settings')}
          </TabsTrigger>
          <TabsTrigger
            value='personalized'
            className='h-auto min-h-9 py-2 text-center leading-tight whitespace-normal'
          >
            {t('User-specific settings')}
          </TabsTrigger>
          <TabsTrigger
            value='adjustments'
            className='h-auto min-h-9 py-2 text-center leading-tight whitespace-normal'
          >
            {t('Manual adjustments')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value='campaign' className='pt-5'>
          <AffiliateCampaignSettings />
        </TabsContent>
        <TabsContent value='global' className='pt-5'>
          <GlobalAffiliateSettings />
        </TabsContent>
        <TabsContent value='personalized' className='pt-5'>
          <PersonalizedAffiliateSettings />
        </TabsContent>
        <TabsContent value='adjustments' className='pt-5'>
          <AffiliateAdjustmentsSection />
        </TabsContent>
      </Tabs>
    </SettingsSection>
  )
}
