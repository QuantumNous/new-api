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
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatTimestampToDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { SectionPageLayout } from '@/components/layout'
import { StatusBadge } from '@/components/status-badge'
import {
  buildAffiliateCommissionAdjustmentPayload,
  buildAffiliateCommissionRecomputePayload,
  buildAffiliateProfilePayload,
  buildAffiliateRuleSetCopyDraftFormValues,
  buildAffiliateRuleSetDiffPreview,
  buildAffiliateRuleSetDraftFormValues,
  buildAffiliateRuleSetDraftPayload,
  buildAffiliateRuleSetExportJson,
  buildAffiliateRuleSetRollbackConfirmation,
  buildAffiliateRuleSetRollbackPayload,
  buildAffiliateRuleSetSaveConfirmation,
  buildAffiliateRuleSetStatusConfirmation,
  buildAffiliateRuleSetStatusPayload,
  buildAffiliateSettlementRunPayload,
  formatAffiliateCentsRMB,
  getAffiliateProfileLevelLabel,
  getAffiliateProfileStatusMeta,
  getAffiliateRuleSetStatusMeta,
  isAffiliateRuleSetReadOnly,
  parseAffiliateRuleSetImportJson,
  validateAffiliateCommissionAdjustmentPayload,
  validateAffiliateCommissionRecomputePayload,
  validateAffiliateRuleSetDraftPayload,
  validateAffiliateSettlementRunPayload,
  validateAffiliateProfilePayload,
} from './admin-lib'
import {
  createAffiliateCommissionAdjustment,
  getAffiliateProfiles,
  getAffiliateRuleSets,
  rollbackAffiliateRuleSetToDraft,
  recomputeAffiliateCommissions,
  runAffiliateSettlementPipeline,
  saveAffiliateRuleSetDraft,
  setAffiliateProfile,
  updateAffiliateRuleSetStatus,
  updateAffiliateProfileStatus,
} from './api'
import { RuleLevelGroupedEditor } from './rule-array-editor'
import type {
  AffiliateCommissionAdjustmentFormValues,
  AffiliateCommissionRecomputeFormValues,
  AffiliateProfile,
  AffiliateProfileFilters,
  AffiliateProfileFormValues,
  AffiliateRuleSet,
  AffiliateRuleSetDraftFormValues,
  AffiliateRuleSetFilters,
  AffiliateSettlementRunFormValues,
} from './types'

const DEFAULT_PAGE_SIZE = 10
const EMPTY_FILTERS: AffiliateProfileFilters = {
  userId: '',
  level: '',
  status: '',
}
const EMPTY_FORM: AffiliateProfileFormValues = {
  userId: '',
  level: '1',
  parentUserId: '',
  inviteCode: '',
  reason: '',
}
const EMPTY_RULE_FILTERS: AffiliateRuleSetFilters = {
  status: '',
}
const EMPTY_SETTLEMENT_RUN_FORM: AffiliateSettlementRunFormValues = {
  ruleSetId: '',
  periodStart: '',
  periodEnd: '',
  freezeDays: '7',
  now: '',
  quotaPerUnit: '',
  usdExchangeRate: '1',
  reason: '',
}
const EMPTY_COMMISSION_RECOMPUTE_FORM: AffiliateCommissionRecomputeFormValues =
  {
    ruleSetId: '',
    periodStart: '',
    periodEnd: '',
    quotaPerUnit: '',
    usdExchangeRate: '1',
    reason: '',
  }
const EMPTY_COMMISSION_ADJUSTMENT_FORM: AffiliateCommissionAdjustmentFormValues =
  {
    affiliateUserId: '',
    downstreamUserId: '',
    ruleSetId: '',
    periodStart: '',
    periodEnd: '',
    commissionCents: '',
    commissionYuan: '',
    reason: '',
  }

function Field(props: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className='space-y-1.5'>
      <Label htmlFor={props.htmlFor}>{props.label}</Label>
      {props.children}
    </div>
  )
}

function ProfileForm(props: {
  values: AffiliateProfileFormValues
  setValues: (values: AffiliateProfileFormValues) => void
  onSubmit: () => void
  isSaving: boolean
}) {
  const { t } = useTranslation()
  const update = (key: keyof AffiliateProfileFormValues, value: string) => {
    props.setValues({ ...props.values, [key]: value })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Configure Affiliate Profile')}</CardTitle>
        <CardDescription>
          {t(
            'Assign level-one or level-two affiliate profiles without changing core user roles'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_minmax(240px,1fr)_minmax(220px,1fr)_auto]'>
          <Field label={t('User ID')} htmlFor='affiliate-profile-user-id'>
            <Input
              id='affiliate-profile-user-id'
              inputMode='numeric'
              value={props.values.userId}
              onChange={(event) => update('userId', event.target.value)}
            />
          </Field>
          <Field label={t('Affiliate Level')} htmlFor='affiliate-profile-level'>
            <NativeSelect
              id='affiliate-profile-level'
              className='w-full'
              value={props.values.level}
              onChange={(event) => update('level', event.target.value)}
            >
              <NativeSelectOption value='1'>
                {t('Level-one affiliate')}
              </NativeSelectOption>
              <NativeSelectOption value='2'>
                {t('Level-two affiliate')}
              </NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field
            label={t('Level-one Parent User ID')}
            htmlFor='affiliate-profile-parent-id'
          >
            <Input
              id='affiliate-profile-parent-id'
              inputMode='numeric'
              placeholder={t('Required for level-two affiliates')}
              value={props.values.parentUserId}
              onChange={(event) => update('parentUserId', event.target.value)}
            />
          </Field>
          <Field label={t('Invite Code')} htmlFor='affiliate-profile-code'>
            <Input
              id='affiliate-profile-code'
              value={props.values.inviteCode}
              onChange={(event) => update('inviteCode', event.target.value)}
            />
          </Field>
        </div>
        <Field label={t('Operation Reason')} htmlFor='affiliate-profile-reason'>
          <Textarea
            id='affiliate-profile-reason'
            value={props.values.reason}
            onChange={(event) => update('reason', event.target.value)}
          />
        </Field>
        <div className='flex flex-wrap gap-2'>
          <Button disabled={props.isSaving} onClick={props.onSubmit}>
            {props.isSaving ? t('Saving') : t('Save Affiliate Profile')}
          </Button>
          <Button
            variant='outline'
            disabled={props.isSaving}
            onClick={() => props.setValues(EMPTY_FORM)}
          >
            {t('Reset')}
          </Button>
          <Button variant='ghost' render={<Link to='/users' />}>
            {t('Open User Management')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function FiltersForm(props: {
  draftFilters: AffiliateProfileFilters
  setDraftFilters: (filters: AffiliateProfileFilters) => void
  onApply: () => void
  onReset: () => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const update = (key: keyof AffiliateProfileFilters, value: string) => {
    props.setDraftFilters({ ...props.draftFilters, [key]: value })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Affiliate Profiles')}</CardTitle>
        <CardDescription>
          {t('Filter affiliate profiles by user, level and status')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,280px)_minmax(260px,320px)_minmax(240px,300px)_auto]'>
          <Field label={t('User ID')} htmlFor='affiliate-filter-user-id'>
            <Input
              id='affiliate-filter-user-id'
              inputMode='numeric'
              value={props.draftFilters.userId}
              disabled={props.disabled}
              onChange={(event) => update('userId', event.target.value)}
            />
          </Field>
          <Field label={t('Affiliate Level')} htmlFor='affiliate-filter-level'>
            <NativeSelect
              id='affiliate-filter-level'
              className='w-full'
              value={props.draftFilters.level}
              disabled={props.disabled}
              onChange={(event) => update('level', event.target.value)}
            >
              <NativeSelectOption value=''>{t('All')}</NativeSelectOption>
              <NativeSelectOption value='1'>
                {t('Level-one affiliate')}
              </NativeSelectOption>
              <NativeSelectOption value='2'>
                {t('Level-two affiliate')}
              </NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field label={t('Status')} htmlFor='affiliate-filter-status'>
            <NativeSelect
              id='affiliate-filter-status'
              className='w-full'
              value={props.draftFilters.status}
              disabled={props.disabled}
              onChange={(event) => update('status', event.target.value)}
            >
              <NativeSelectOption value=''>{t('All')}</NativeSelectOption>
              <NativeSelectOption value='active'>
                {t('Active')}
              </NativeSelectOption>
              <NativeSelectOption value='disabled'>
                {t('Disabled')}
              </NativeSelectOption>
            </NativeSelect>
          </Field>
          <div className='flex min-w-56 items-end gap-2'>
            <Button
              className='flex-1'
              disabled={props.disabled}
              onClick={props.onApply}
            >
              {t('Apply')}
            </Button>
            <Button
              className='flex-1'
              variant='outline'
              disabled={props.disabled}
              onClick={props.onReset}
            >
              {t('Reset')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ProfilesTable(props: {
  profiles: AffiliateProfile[]
  total: number
  page: number
  pageSize: number
  isLoading: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onStatusChange: (
    profile: AffiliateProfile,
    status: 'active' | 'disabled'
  ) => void
  isMutating: boolean
}) {
  const { t } = useTranslation()
  const hasNext = props.page * props.pageSize < props.total

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Affiliate Profile List')}</CardTitle>
        <CardDescription>
          {t(
            'Enable or disable affiliate identities derived from affiliate profiles'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('User ID')}</TableHead>
              <TableHead>{t('Affiliate Level')}</TableHead>
              <TableHead>{t('Status')}</TableHead>
              <TableHead>{t('Level-one Parent User ID')}</TableHead>
              <TableHead>{t('Invite Code')}</TableHead>
              <TableHead>{t('Updated At')}</TableHead>
              <TableHead className='text-right'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className='text-muted-foreground h-24 text-center'
                >
                  {t('Loading')}
                </TableCell>
              </TableRow>
            ) : props.profiles.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className='text-muted-foreground h-24 text-center'
                >
                  {t('No affiliate profiles')}
                </TableCell>
              </TableRow>
            ) : (
              props.profiles.map((profile) => {
                const status = getAffiliateProfileStatusMeta(profile.status, t)
                const nextStatus =
                  profile.status === 'active' ? 'disabled' : 'active'
                return (
                  <TableRow key={profile.id || profile.user_id}>
                    <TableCell>
                      <div className='flex flex-col'>
                        <span>{profile.user_id}</span>
                        <span className='text-muted-foreground text-xs'>
                          {profile.username || '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getAffiliateProfileLevelLabel(profile.level, t)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={status.label}
                        variant={status.variant}
                        copyable={false}
                      />
                    </TableCell>
                    <TableCell>{profile.parent_user_id || '-'}</TableCell>
                    <TableCell>
                      {profile.invite_code || profile.aff_code || '-'}
                    </TableCell>
                    <TableCell>
                      {formatTimestampToDate(profile.updated_at)}
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button
                        size='sm'
                        variant={
                          nextStatus === 'disabled' ? 'destructive' : 'outline'
                        }
                        disabled={props.isMutating}
                        onClick={() =>
                          props.onStatusChange(profile, nextStatus)
                        }
                      >
                        {nextStatus === 'disabled' ? t('Disable') : t('Enable')}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='text-muted-foreground text-sm'>
            {t('Total')}: {props.total}
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <NativeSelect
              value={String(props.pageSize)}
              onChange={(event) =>
                props.onPageSizeChange(Number(event.target.value))
              }
            >
              <NativeSelectOption value='10'>
                {t('10 / page')}
              </NativeSelectOption>
              <NativeSelectOption value='20'>
                {t('20 / page')}
              </NativeSelectOption>
              <NativeSelectOption value='50'>
                {t('50 / page')}
              </NativeSelectOption>
            </NativeSelect>
            <Button
              variant='outline'
              disabled={props.page <= 1 || props.isLoading}
              onClick={() => props.onPageChange(Math.max(1, props.page - 1))}
            >
              {t('Previous')}
            </Button>
            <span className='text-muted-foreground text-sm'>
              {t('Page')} {props.page}
            </span>
            <Button
              variant='outline'
              disabled={!hasNext || props.isLoading}
              onClick={() => props.onPageChange(props.page + 1)}
            >
              {t('Next')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function RuleSetFiltersForm(props: {
  draftFilters: AffiliateRuleSetFilters
  setDraftFilters: (filters: AffiliateRuleSetFilters) => void
  onApply: () => void
  onReset: () => void
  disabled?: boolean
}) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Affiliate Rule Sets')}</CardTitle>
        <CardDescription>
          {t('Filter versioned affiliate rules by lifecycle status')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='grid gap-3 md:grid-cols-[minmax(260px,360px)_auto]'>
          <Field label={t('Rule Status')} htmlFor='affiliate-rule-status'>
            <NativeSelect
              id='affiliate-rule-status'
              className='w-full'
              value={props.draftFilters.status || ''}
              disabled={props.disabled}
              onChange={(event) =>
                props.setDraftFilters({
                  ...props.draftFilters,
                  status: event.target.value,
                })
              }
            >
              <NativeSelectOption value=''>{t('All')}</NativeSelectOption>
              <NativeSelectOption value='draft'>
                {t('Draft')}
              </NativeSelectOption>
              <NativeSelectOption value='published'>
                {t('Published')}
              </NativeSelectOption>
              <NativeSelectOption value='archived'>
                {t('Archived')}
              </NativeSelectOption>
            </NativeSelect>
          </Field>
          <div className='flex items-end gap-2'>
            <Button disabled={props.disabled} onClick={props.onApply}>
              {t('Apply')}
            </Button>
            <Button
              variant='outline'
              disabled={props.disabled}
              onClick={props.onReset}
            >
              {t('Reset')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function RuleSetsTable(props: {
  ruleSets: AffiliateRuleSet[]
  total: number
  page: number
  pageSize: number
  isLoading: boolean
  isMutating: boolean
  onEdit: (ruleSet: AffiliateRuleSet) => void
  onCopy: (ruleSet: AffiliateRuleSet) => void
  onRollback: (ruleSet: AffiliateRuleSet) => void
  onStatusChange: (
    ruleSet: AffiliateRuleSet,
    action: 'publish' | 'archive'
  ) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}) {
  const { t } = useTranslation()
  const hasNext = props.page * props.pageSize < props.total

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Affiliate Rule Set List')}</CardTitle>
        <CardDescription>
          {t(
            'Publish a draft to activate a rule version; older published rules are archived by the backend'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Rule Set ID')}</TableHead>
              <TableHead>{t('Version')}</TableHead>
              <TableHead>{t('Name')}</TableHead>
              <TableHead>{t('Status')}</TableHead>
              <TableHead>{t('Effective Window')}</TableHead>
              <TableHead>{t('Published At')}</TableHead>
              <TableHead className='text-right'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className='text-muted-foreground h-24 text-center'
                >
                  {t('Loading')}
                </TableCell>
              </TableRow>
            ) : props.ruleSets.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className='text-muted-foreground h-24 text-center'
                >
                  {t('No affiliate rule sets')}
                </TableCell>
              </TableRow>
            ) : (
              props.ruleSets.map((ruleSet) => {
                const status = getAffiliateRuleSetStatusMeta(ruleSet.status, t)
                const start = ruleSet.effective_start
                  ? formatTimestampToDate(ruleSet.effective_start)
                  : t('Immediately')
                const end = ruleSet.effective_end
                  ? formatTimestampToDate(ruleSet.effective_end)
                  : t('Long term')
                return (
                  <TableRow key={ruleSet.id}>
                    <TableCell>{ruleSet.id}</TableCell>
                    <TableCell>{ruleSet.version}</TableCell>
                    <TableCell>{ruleSet.name}</TableCell>
                    <TableCell>
                      <StatusBadge
                        label={status.label}
                        variant={status.variant}
                        copyable={false}
                      />
                    </TableCell>
                    <TableCell>
                      {start} - {end}
                    </TableCell>
                    <TableCell>
                      {ruleSet.published_at
                        ? formatTimestampToDate(ruleSet.published_at)
                        : '-'}
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-2'>
                        <Button
                          size='sm'
                          variant='outline'
                          disabled={props.isMutating}
                          onClick={() => props.onEdit(ruleSet)}
                        >
                          {isAffiliateRuleSetReadOnly(ruleSet)
                            ? t('View')
                            : t('Edit')}
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          disabled={props.isMutating}
                          onClick={() => props.onCopy(ruleSet)}
                        >
                          {t('Copy Draft')}
                        </Button>
                        {isAffiliateRuleSetReadOnly(ruleSet) && (
                          <Button
                            size='sm'
                            variant='outline'
                            disabled={props.isMutating}
                            onClick={() => props.onRollback(ruleSet)}
                          >
                            {t('Rollback Draft')}
                          </Button>
                        )}
                        {ruleSet.status === 'draft' && (
                          <Button
                            size='sm'
                            disabled={props.isMutating}
                            onClick={() =>
                              props.onStatusChange(ruleSet, 'publish')
                            }
                          >
                            {t('Publish')}
                          </Button>
                        )}
                        {ruleSet.status !== 'archived' && (
                          <Button
                            size='sm'
                            variant='outline'
                            disabled={props.isMutating}
                            onClick={() =>
                              props.onStatusChange(ruleSet, 'archive')
                            }
                          >
                            {t('Archive')}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='text-muted-foreground text-sm'>
            {t('Total')}: {props.total}
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <NativeSelect
              value={String(props.pageSize)}
              onChange={(event) =>
                props.onPageSizeChange(Number(event.target.value))
              }
            >
              <NativeSelectOption value='10'>
                {t('10 / page')}
              </NativeSelectOption>
              <NativeSelectOption value='20'>
                {t('20 / page')}
              </NativeSelectOption>
              <NativeSelectOption value='50'>
                {t('50 / page')}
              </NativeSelectOption>
            </NativeSelect>
            <Button
              variant='outline'
              disabled={props.page <= 1 || props.isLoading}
              onClick={() => props.onPageChange(Math.max(1, props.page - 1))}
            >
              {t('Previous')}
            </Button>
            <span className='text-muted-foreground text-sm'>
              {t('Page')} {props.page}
            </span>
            <Button
              variant='outline'
              disabled={!hasNext || props.isLoading}
              onClick={() => props.onPageChange(props.page + 1)}
            >
              {t('Next')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function RuleSetDraftForm(props: {
  values: AffiliateRuleSetDraftFormValues
  baselineValues: AffiliateRuleSetDraftFormValues
  setValues: (values: AffiliateRuleSetDraftFormValues) => void
  onSubmit: () => void
  onNew: () => void
  isSaving: boolean
  readOnly: boolean
}) {
  const { t } = useTranslation()
  const [editorMode, setEditorMode] = useState<'visual' | 'json'>('visual')
  const [transferText, setTransferText] = useState('')
  const [transferError, setTransferError] = useState('')
  let diffItems: Array<{ section: string; before: string; after: string }> = []
  try {
    diffItems = buildAffiliateRuleSetDiffPreview(
      props.baselineValues,
      props.values
    )
  } catch {
    diffItems = []
  }
  const update = (
    key: keyof AffiliateRuleSetDraftFormValues,
    value: string
  ) => {
    if (props.readOnly) return
    props.setValues({ ...props.values, [key]: value })
  }
  const handleExport = () => {
    try {
      setTransferText(buildAffiliateRuleSetExportJson(props.values))
      setTransferError('')
      toast.success(t('Rule draft exported'))
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('Rule JSON is invalid')
      setTransferError(message)
      toast.error(message)
    }
  }
  const handleImport = () => {
    if (props.readOnly) return
    try {
      props.setValues(parseAffiliateRuleSetImportJson(transferText))
      setTransferError('')
      toast.success(t('Rule draft imported'))
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('Rule JSON is invalid')
      setTransferError(message)
      toast.error(message)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {props.readOnly
            ? t('Affiliate Rule Set Read-only View')
            : t('Affiliate Rule Set Draft')}
        </CardTitle>
        <CardDescription>
          {props.readOnly
            ? t(
                'Published and archived rule sets are read-only. Copy this version before editing.'
              )
            : t(
                'Edit commission, KPI, head fee, risk and settlement rules as versioned JSON blocks'
              )}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
          <Field label={t('Rule Set ID')} htmlFor='affiliate-rule-id'>
            <Input
              id='affiliate-rule-id'
              inputMode='numeric'
              disabled={props.readOnly}
              value={props.values.id || ''}
              onChange={(event) => update('id', event.target.value)}
            />
          </Field>
          <Field label={t('Version')} htmlFor='affiliate-rule-version'>
            <Input
              id='affiliate-rule-version'
              disabled={props.readOnly}
              value={props.values.version || ''}
              onChange={(event) => update('version', event.target.value)}
            />
          </Field>
          <Field label={t('Name')} htmlFor='affiliate-rule-name'>
            <Input
              id='affiliate-rule-name'
              disabled={props.readOnly}
              value={props.values.name || ''}
              onChange={(event) => update('name', event.target.value)}
            />
          </Field>
          <Field label={t('Operation Reason')} htmlFor='affiliate-rule-reason'>
            <Input
              id='affiliate-rule-reason'
              disabled={props.readOnly}
              value={props.values.reason || ''}
              onChange={(event) => update('reason', event.target.value)}
            />
          </Field>
          <Field
            label={t('Effective Start Timestamp')}
            htmlFor='affiliate-rule-start'
          >
            <Input
              id='affiliate-rule-start'
              inputMode='numeric'
              disabled={props.readOnly}
              value={props.values.effectiveStart || ''}
              onChange={(event) => update('effectiveStart', event.target.value)}
            />
          </Field>
          <Field
            label={t('Effective End Timestamp')}
            htmlFor='affiliate-rule-end'
          >
            <Input
              id='affiliate-rule-end'
              inputMode='numeric'
              disabled={props.readOnly}
              value={props.values.effectiveEnd || ''}
              onChange={(event) => update('effectiveEnd', event.target.value)}
            />
          </Field>
          <Field label={t('Settlement Cycle')} htmlFor='affiliate-rule-cycle'>
            <Input
              id='affiliate-rule-cycle'
              disabled={props.readOnly}
              value={props.values.settlementCycle || ''}
              onChange={(event) =>
                update('settlementCycle', event.target.value)
              }
            />
          </Field>
          <Field label={t('Freeze Days')} htmlFor='affiliate-rule-freeze-days'>
            <Input
              id='affiliate-rule-freeze-days'
              inputMode='numeric'
              disabled={props.readOnly}
              value={props.values.freezeDays || ''}
              onChange={(event) => update('freezeDays', event.target.value)}
            />
          </Field>
          <Field
            label={t('Minimum Settlement Amount (yuan)')}
            htmlFor='affiliate-rule-min-settlement'
          >
            <Input
              id='affiliate-rule-min-settlement'
              inputMode='decimal'
              disabled={props.readOnly}
              value={props.values.minSettlementAmountYuan || ''}
              onChange={(event) =>
                update('minSettlementAmountYuan', event.target.value)
              }
            />
          </Field>
          <div className='space-y-1.5'>
            <Label htmlFor='affiliate-rule-manual-review'>
              {t('Manual Review')}
            </Label>
            <label className='border-border flex h-9 items-center gap-2 rounded-lg border px-3 text-sm'>
              <input
                id='affiliate-rule-manual-review'
                type='checkbox'
                disabled={props.readOnly}
                checked={props.values.manualReviewEnabled === true}
                onChange={(event) =>
                  props.setValues({
                    ...props.values,
                    manualReviewEnabled: event.target.checked,
                  })
                }
              />
              {t('Enabled')}
            </label>
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='affiliate-rule-auto-settlement'>
              {t('Automatic Settlement')}
            </Label>
            <label className='border-border flex h-9 items-center gap-2 rounded-lg border px-3 text-sm'>
              <input
                id='affiliate-rule-auto-settlement'
                type='checkbox'
                disabled={props.readOnly}
                checked={props.values.autoSettlementEnabled !== false}
                onChange={(event) =>
                  props.setValues({
                    ...props.values,
                    autoSettlementEnabled: event.target.checked,
                  })
                }
              />
              {t('Enabled')}
            </label>
          </div>
          <Field label={t('Review Note')} htmlFor='affiliate-rule-review-note'>
            <Textarea
              id='affiliate-rule-review-note'
              disabled={props.readOnly}
              value={props.values.reviewNote || ''}
              onChange={(event) => update('reviewNote', event.target.value)}
            />
          </Field>
        </div>

        <div className='space-y-3'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div>
              <div className='font-medium'>{t('Rule Details')}</div>
              <div className='text-muted-foreground text-xs'>
                {t(
                  'Switch between editable rule tables and raw JSON for batch edits'
                )}
              </div>
            </div>
            <div className='flex rounded-lg border p-1'>
              <Button
                size='sm'
                variant={editorMode === 'visual' ? 'default' : 'ghost'}
                onClick={() => setEditorMode('visual')}
              >
                {t('Visual')}
              </Button>
              <Button
                size='sm'
                variant={editorMode === 'json' ? 'default' : 'ghost'}
                onClick={() => setEditorMode('json')}
              >
                JSON
              </Button>
            </div>
          </div>

          {editorMode === 'visual' ? (
            <RuleLevelGroupedEditor
              readOnly={props.readOnly}
              sections={[
                {
                  title: t('Commission Base Rules'),
                  field: 'commissionRulesJson',
                  description: t(
                    'Set default rate, cap rate, and minimum settlement amount by affiliate level.'
                  ),
                  value: props.values.commissionRulesJson,
                  onChange: (value) => update('commissionRulesJson', value),
                },
                {
                  title: t('Commission Tiers'),
                  field: 'commissionTiersJson',
                  description: t(
                    'Set commission rate and cap by accumulated net paid ranges.'
                  ),
                  value: props.values.commissionTiersJson,
                  onChange: (value) => update('commissionTiersJson', value),
                },
                {
                  title: t('KPI Tiers'),
                  field: 'kpiTiersJson',
                  description: t(
                    'Set KPI coefficients by effective new users, net paid amount, and quality metrics.'
                  ),
                  value: props.values.kpiTiersJson,
                  onChange: (value) => update('kpiTiersJson', value),
                },
                {
                  title: t('Head Fee Rules'),
                  field: 'headFeeRulesJson',
                  description: t(
                    'Set head fee and unlock requirements by KPI tier.'
                  ),
                  value: props.values.headFeeRulesJson,
                  onChange: (value) => update('headFeeRulesJson', value),
                },
                {
                  title: t('Quality Thresholds'),
                  field: 'riskRulesJson',
                  description: t(
                    'Set quality/risk thresholds for gift-only ratio, abnormal ratio, refund ratio, and second-payment ratio.'
                  ),
                  value: props.values.riskRulesJson,
                  onChange: (value) => update('riskRulesJson', value),
                },
              ]}
            />
          ) : (
            <div className='grid gap-3 xl:grid-cols-2'>
              <Field
                label={t('Commission Rules JSON')}
                htmlFor='affiliate-commission-rules-json'
              >
                <Textarea
                  id='affiliate-commission-rules-json'
                  className='min-h-40 font-mono text-xs'
                  readOnly={props.readOnly}
                  value={props.values.commissionRulesJson || ''}
                  onChange={(event) =>
                    update('commissionRulesJson', event.target.value)
                  }
                />
              </Field>
              <Field
                label={t('Commission Tiers JSON')}
                htmlFor='affiliate-commission-tiers-json'
              >
                <Textarea
                  id='affiliate-commission-tiers-json'
                  className='min-h-40 font-mono text-xs'
                  readOnly={props.readOnly}
                  value={props.values.commissionTiersJson || ''}
                  onChange={(event) =>
                    update('commissionTiersJson', event.target.value)
                  }
                />
              </Field>
              <Field label={t('KPI Tiers JSON')} htmlFor='affiliate-kpi-json'>
                <Textarea
                  id='affiliate-kpi-json'
                  className='min-h-40 font-mono text-xs'
                  readOnly={props.readOnly}
                  value={props.values.kpiTiersJson || ''}
                  onChange={(event) =>
                    update('kpiTiersJson', event.target.value)
                  }
                />
              </Field>
              <Field
                label={t('Head Fee Rules JSON')}
                htmlFor='affiliate-head-fee-json'
              >
                <Textarea
                  id='affiliate-head-fee-json'
                  className='min-h-40 font-mono text-xs'
                  readOnly={props.readOnly}
                  value={props.values.headFeeRulesJson || ''}
                  onChange={(event) =>
                    update('headFeeRulesJson', event.target.value)
                  }
                />
              </Field>
              <Field label={t('Risk Rules JSON')} htmlFor='affiliate-risk-json'>
                <Textarea
                  id='affiliate-risk-json'
                  className='min-h-40 font-mono text-xs'
                  readOnly={props.readOnly}
                  value={props.values.riskRulesJson || ''}
                  onChange={(event) =>
                    update('riskRulesJson', event.target.value)
                  }
                />
              </Field>
            </div>
          )}
        </div>

        <div className='grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]'>
          <Field
            label={t('Rule Import / Export JSON')}
            htmlFor='affiliate-rule-transfer-json'
          >
            <Textarea
              id='affiliate-rule-transfer-json'
              className='min-h-32 font-mono text-xs'
              value={transferText}
              placeholder={t(
                'Export the current draft or paste rule JSON to import'
              )}
              onChange={(event) => setTransferText(event.target.value)}
            />
            {transferError && (
              <div className='text-destructive mt-1 text-xs'>
                {transferError}
              </div>
            )}
          </Field>
          <div className='rounded-lg border p-3'>
            <div className='font-medium'>{t('Rule Draft Diff Preview')}</div>
            <div className='text-muted-foreground mt-1 text-xs'>
              {t('Only changed draft sections are listed before saving')}
            </div>
            <div className='mt-3 max-h-48 overflow-auto'>
              {diffItems.length === 0 ? (
                <div className='text-muted-foreground text-sm'>
                  {t('No draft changes detected')}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Section')}</TableHead>
                      <TableHead>{t('Before')}</TableHead>
                      <TableHead>{t('After')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diffItems.map((item) => (
                      <TableRow key={item.section}>
                        <TableCell>{t(item.section)}</TableCell>
                        <TableCell className='text-muted-foreground'>
                          {item.before === 'changed'
                            ? t('Changed')
                            : item.before}
                        </TableCell>
                        <TableCell>
                          {item.after === 'changed' ? t('Changed') : item.after}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>

        <div className='flex flex-wrap gap-2'>
          <Button
            disabled={props.isSaving || props.readOnly}
            onClick={props.onSubmit}
          >
            {props.readOnly
              ? t('Read-only')
              : props.isSaving
                ? t('Saving')
                : t('Save Rule Draft')}
          </Button>
          <Button
            variant='outline'
            disabled={props.isSaving}
            onClick={props.onNew}
          >
            {t('New Default Draft')}
          </Button>
          <Button
            variant='outline'
            disabled={props.isSaving}
            onClick={handleExport}
          >
            {t('Export Draft JSON')}
          </Button>
          <Button
            variant='outline'
            disabled={props.isSaving || props.readOnly || !transferText.trim()}
            onClick={handleImport}
          >
            {t('Import Draft JSON')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function FinanceOperationsPanel(props: {
  settlementRunValues: AffiliateSettlementRunFormValues
  setSettlementRunValues: (values: AffiliateSettlementRunFormValues) => void
  commissionRecomputeValues: AffiliateCommissionRecomputeFormValues
  setCommissionRecomputeValues: (
    values: AffiliateCommissionRecomputeFormValues
  ) => void
  commissionAdjustmentValues: AffiliateCommissionAdjustmentFormValues
  setCommissionAdjustmentValues: (
    values: AffiliateCommissionAdjustmentFormValues
  ) => void
  lastResult: string
  onSettlementRun: () => void
  onCommissionRecompute: () => void
  onCommissionAdjustment: () => void
  isSettlementRunSaving: boolean
  isCommissionRecomputeSaving: boolean
  isCommissionAdjustmentSaving: boolean
}) {
  const { t } = useTranslation()
  const updateSettlementRun = (
    key: keyof AffiliateSettlementRunFormValues,
    value: string
  ) => {
    props.setSettlementRunValues({
      ...props.settlementRunValues,
      [key]: value,
    })
  }
  const updateCommissionRecompute = (
    key: keyof AffiliateCommissionRecomputeFormValues,
    value: string
  ) => {
    props.setCommissionRecomputeValues({
      ...props.commissionRecomputeValues,
      [key]: value,
    })
  }
  const updateCommissionAdjustment = (
    key: keyof AffiliateCommissionAdjustmentFormValues,
    value: string
  ) => {
    props.setCommissionAdjustmentValues({
      ...props.commissionAdjustmentValues,
      [key]: value,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Affiliate Finance Operations')}</CardTitle>
        <CardDescription>
          {t(
            'Run KPI, commission, head fee and settlement orchestration, recompute pending commissions, or create a manual commission adjustment'
          )}
        </CardDescription>
        {props.lastResult && (
          <div className='text-foreground text-sm font-medium'>
            {props.lastResult}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className='grid gap-3 xl:grid-cols-3'>
          <Card className='border-dashed'>
            <CardHeader>
              <CardTitle className='text-base'>{t('Settlement Run')}</CardTitle>
              <CardDescription>
                {t(
                  'Generate KPI snapshots, pending events and draft settlements'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-2'>
              <Field label={t('Rule Set ID')} htmlFor='finance-run-rule-id'>
                <Input
                  id='finance-run-rule-id'
                  inputMode='numeric'
                  placeholder={t('0 selects the published rule automatically')}
                  value={props.settlementRunValues.ruleSetId || ''}
                  onChange={(event) =>
                    updateSettlementRun('ruleSetId', event.target.value)
                  }
                />
              </Field>
              <div className='grid gap-2 md:grid-cols-2 xl:grid-cols-2'>
                <Field
                  label={t('Period Start')}
                  htmlFor='finance-run-period-start'
                >
                  <Input
                    id='finance-run-period-start'
                    type='datetime-local'
                    value={props.settlementRunValues.periodStart || ''}
                    onChange={(event) =>
                      updateSettlementRun('periodStart', event.target.value)
                    }
                  />
                </Field>
                <Field label={t('Period End')} htmlFor='finance-run-period-end'>
                  <Input
                    id='finance-run-period-end'
                    type='datetime-local'
                    value={props.settlementRunValues.periodEnd || ''}
                    onChange={(event) =>
                      updateSettlementRun('periodEnd', event.target.value)
                    }
                  />
                </Field>
              </div>
              <div className='grid gap-2 md:grid-cols-2 xl:grid-cols-2'>
                <Field label={t('Freeze Days')} htmlFor='finance-run-freeze'>
                  <Input
                    id='finance-run-freeze'
                    inputMode='numeric'
                    value={props.settlementRunValues.freezeDays || ''}
                    onChange={(event) =>
                      updateSettlementRun('freezeDays', event.target.value)
                    }
                  />
                </Field>
                <Field label={t('Run Timestamp')} htmlFor='finance-run-now'>
                  <Input
                    id='finance-run-now'
                    type='datetime-local'
                    placeholder={t('Empty uses current server time')}
                    value={props.settlementRunValues.now || ''}
                    onChange={(event) =>
                      updateSettlementRun('now', event.target.value)
                    }
                  />
                </Field>
              </div>
              <div className='grid gap-2 md:grid-cols-2 xl:grid-cols-2'>
                <Field label={t('Quota Per Unit')} htmlFor='finance-run-quota'>
                  <Input
                    id='finance-run-quota'
                    inputMode='decimal'
                    placeholder={t('Empty uses system default')}
                    value={props.settlementRunValues.quotaPerUnit || ''}
                    onChange={(event) =>
                      updateSettlementRun('quotaPerUnit', event.target.value)
                    }
                  />
                </Field>
                <Field
                  label={t('CNY Exchange Rate (1:1)')}
                  htmlFor='finance-run-exchange-rate'
                >
                  <Input
                    id='finance-run-exchange-rate'
                    inputMode='decimal'
                    placeholder='1'
                    value={props.settlementRunValues.usdExchangeRate || ''}
                    onChange={(event) =>
                      updateSettlementRun('usdExchangeRate', event.target.value)
                    }
                  />
                </Field>
              </div>
              <Field label={t('Operation Reason')} htmlFor='finance-run-reason'>
                <Input
                  id='finance-run-reason'
                  value={props.settlementRunValues.reason || ''}
                  onChange={(event) =>
                    updateSettlementRun('reason', event.target.value)
                  }
                />
              </Field>
              <Button
                disabled={props.isSettlementRunSaving}
                onClick={props.onSettlementRun}
              >
                {props.isSettlementRunSaving
                  ? t('Running')
                  : t('Run Settlement Pipeline')}
              </Button>
            </CardContent>
          </Card>

          <Card className='border-dashed'>
            <CardHeader>
              <CardTitle className='text-base'>
                {t('Commission Recompute')}
              </CardTitle>
              <CardDescription>
                {t(
                  'Void generated pending events and rebuild them for a period'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-2'>
              <Field
                label={t('Rule Set ID')}
                htmlFor='finance-recompute-rule-id'
              >
                <Input
                  id='finance-recompute-rule-id'
                  inputMode='numeric'
                  placeholder={t('0 selects the published rule automatically')}
                  value={props.commissionRecomputeValues.ruleSetId || ''}
                  onChange={(event) =>
                    updateCommissionRecompute('ruleSetId', event.target.value)
                  }
                />
              </Field>
              <div className='grid gap-2 md:grid-cols-2 xl:grid-cols-2'>
                <Field
                  label={t('Period Start')}
                  htmlFor='finance-recompute-period-start'
                >
                  <Input
                    id='finance-recompute-period-start'
                    type='datetime-local'
                    value={props.commissionRecomputeValues.periodStart || ''}
                    onChange={(event) =>
                      updateCommissionRecompute(
                        'periodStart',
                        event.target.value
                      )
                    }
                  />
                </Field>
                <Field
                  label={t('Period End')}
                  htmlFor='finance-recompute-period-end'
                >
                  <Input
                    id='finance-recompute-period-end'
                    type='datetime-local'
                    value={props.commissionRecomputeValues.periodEnd || ''}
                    onChange={(event) =>
                      updateCommissionRecompute('periodEnd', event.target.value)
                    }
                  />
                </Field>
              </div>
              <div className='grid gap-2 md:grid-cols-2 xl:grid-cols-2'>
                <Field
                  label={t('Quota Per Unit')}
                  htmlFor='finance-recompute-quota'
                >
                  <Input
                    id='finance-recompute-quota'
                    inputMode='decimal'
                    placeholder={t('Empty uses system default')}
                    value={props.commissionRecomputeValues.quotaPerUnit || ''}
                    onChange={(event) =>
                      updateCommissionRecompute(
                        'quotaPerUnit',
                        event.target.value
                      )
                    }
                  />
                </Field>
                <Field
                  label={t('CNY Exchange Rate (1:1)')}
                  htmlFor='finance-recompute-exchange-rate'
                >
                  <Input
                    id='finance-recompute-exchange-rate'
                    inputMode='decimal'
                    placeholder='1'
                    value={
                      props.commissionRecomputeValues.usdExchangeRate || ''
                    }
                    onChange={(event) =>
                      updateCommissionRecompute(
                        'usdExchangeRate',
                        event.target.value
                      )
                    }
                  />
                </Field>
              </div>
              <Field
                label={t('Operation Reason')}
                htmlFor='finance-recompute-reason'
              >
                <Input
                  id='finance-recompute-reason'
                  value={props.commissionRecomputeValues.reason || ''}
                  onChange={(event) =>
                    updateCommissionRecompute('reason', event.target.value)
                  }
                />
              </Field>
              <Button
                variant='outline'
                disabled={props.isCommissionRecomputeSaving}
                onClick={props.onCommissionRecompute}
              >
                {props.isCommissionRecomputeSaving
                  ? t('Recomputing')
                  : t('Recompute Commission Events')}
              </Button>
            </CardContent>
          </Card>

          <Card className='border-dashed'>
            <CardHeader>
              <CardTitle className='text-base'>
                {t('Manual Commission Adjustment')}
              </CardTitle>
              <CardDescription>
                {t('Create a positive or negative pending manual event')}
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-2'>
              <div className='grid gap-2 md:grid-cols-2 xl:grid-cols-2'>
                <Field
                  label={t('Affiliate User ID')}
                  htmlFor='finance-adjust-affiliate-user'
                >
                  <Input
                    id='finance-adjust-affiliate-user'
                    inputMode='numeric'
                    value={
                      props.commissionAdjustmentValues.affiliateUserId || ''
                    }
                    onChange={(event) =>
                      updateCommissionAdjustment(
                        'affiliateUserId',
                        event.target.value
                      )
                    }
                  />
                </Field>
                <Field
                  label={t('Downstream User ID')}
                  htmlFor='finance-adjust-downstream-user'
                >
                  <Input
                    id='finance-adjust-downstream-user'
                    inputMode='numeric'
                    value={
                      props.commissionAdjustmentValues.downstreamUserId || ''
                    }
                    onChange={(event) =>
                      updateCommissionAdjustment(
                        'downstreamUserId',
                        event.target.value
                      )
                    }
                  />
                </Field>
              </div>
              <Field label={t('Rule Set ID')} htmlFor='finance-adjust-rule-id'>
                <Input
                  id='finance-adjust-rule-id'
                  inputMode='numeric'
                  placeholder={t('0 selects the published rule automatically')}
                  value={props.commissionAdjustmentValues.ruleSetId || ''}
                  onChange={(event) =>
                    updateCommissionAdjustment('ruleSetId', event.target.value)
                  }
                />
              </Field>
              <div className='grid gap-2 md:grid-cols-2 xl:grid-cols-2'>
                <Field
                  label={t('Period Start')}
                  htmlFor='finance-adjust-period-start'
                >
                  <Input
                    id='finance-adjust-period-start'
                    type='datetime-local'
                    value={props.commissionAdjustmentValues.periodStart || ''}
                    onChange={(event) =>
                      updateCommissionAdjustment(
                        'periodStart',
                        event.target.value
                      )
                    }
                  />
                </Field>
                <Field
                  label={t('Period End')}
                  htmlFor='finance-adjust-period-end'
                >
                  <Input
                    id='finance-adjust-period-end'
                    type='datetime-local'
                    value={props.commissionAdjustmentValues.periodEnd || ''}
                    onChange={(event) =>
                      updateCommissionAdjustment(
                        'periodEnd',
                        event.target.value
                      )
                    }
                  />
                </Field>
              </div>
              <Field
                label={t('Adjustment Amount (yuan)')}
                htmlFor='finance-adjust-cents'
              >
                <Input
                  id='finance-adjust-cents'
                  inputMode='decimal'
                  placeholder={t('Use negative yuan for clawback')}
                  value={props.commissionAdjustmentValues.commissionYuan || ''}
                  onChange={(event) =>
                    updateCommissionAdjustment(
                      'commissionYuan',
                      event.target.value
                    )
                  }
                />
              </Field>
              <Field
                label={t('Operation Reason')}
                htmlFor='finance-adjust-reason'
              >
                <Input
                  id='finance-adjust-reason'
                  value={props.commissionAdjustmentValues.reason || ''}
                  onChange={(event) =>
                    updateCommissionAdjustment('reason', event.target.value)
                  }
                />
              </Field>
              <Button
                variant='destructive'
                disabled={props.isCommissionAdjustmentSaving}
                onClick={props.onCommissionAdjustment}
              >
                {props.isCommissionAdjustmentSaving
                  ? t('Creating')
                  : t('Create Manual Adjustment')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  )
}

export function AffiliateAdmin() {
  const { t } = useTranslation()
  const [formValues, setFormValues] =
    useState<AffiliateProfileFormValues>(EMPTY_FORM)
  const [filters, setFilters] = useState<AffiliateProfileFilters>(EMPTY_FILTERS)
  const [draftFilters, setDraftFilters] =
    useState<AffiliateProfileFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [ruleSetFormValues, setRuleSetFormValues] =
    useState<AffiliateRuleSetDraftFormValues>(
      buildAffiliateRuleSetDraftFormValues()
    )
  const [ruleSetBaselineValues, setRuleSetBaselineValues] =
    useState<AffiliateRuleSetDraftFormValues>(
      buildAffiliateRuleSetDraftFormValues()
    )
  const [ruleSetReadOnly, setRuleSetReadOnly] = useState(false)
  const [ruleSetFilters, setRuleSetFilters] =
    useState<AffiliateRuleSetFilters>(EMPTY_RULE_FILTERS)
  const [draftRuleSetFilters, setDraftRuleSetFilters] =
    useState<AffiliateRuleSetFilters>(EMPTY_RULE_FILTERS)
  const [ruleSetPage, setRuleSetPage] = useState(1)
  const [ruleSetPageSize, setRuleSetPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [settlementRunValues, setSettlementRunValues] =
    useState<AffiliateSettlementRunFormValues>(EMPTY_SETTLEMENT_RUN_FORM)
  const [commissionRecomputeValues, setCommissionRecomputeValues] =
    useState<AffiliateCommissionRecomputeFormValues>(
      EMPTY_COMMISSION_RECOMPUTE_FORM
    )
  const [commissionAdjustmentValues, setCommissionAdjustmentValues] =
    useState<AffiliateCommissionAdjustmentFormValues>(
      EMPTY_COMMISSION_ADJUSTMENT_FORM
    )
  const [lastFinanceResult, setLastFinanceResult] = useState('')

  const profilesQuery = useQuery({
    queryKey: ['affiliate', 'admin', 'profiles', page, pageSize, filters],
    queryFn: async () => {
      const result = await getAffiliateProfiles({ page, pageSize, filters })
      if (!result.success) {
        toast.error(t('Failed to load affiliate profiles'))
        return { items: [], total: 0 }
      }
      return {
        items: result.data?.items ?? [],
        total: result.data?.total ?? 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const ruleSetsQuery = useQuery({
    queryKey: [
      'affiliate',
      'admin',
      'rule-sets',
      ruleSetPage,
      ruleSetPageSize,
      ruleSetFilters,
    ],
    queryFn: async () => {
      const result = await getAffiliateRuleSets({
        page: ruleSetPage,
        pageSize: ruleSetPageSize,
        filters: ruleSetFilters,
      })
      if (!result.success) {
        toast.error(t('Failed to load affiliate rule sets'))
        return { items: [], total: 0 }
      }
      return {
        items: result.data?.items ?? [],
        total: result.data?.total ?? 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const saveMutation = useMutation({
    mutationFn: setAffiliateProfile,
    onSuccess: async (result) => {
      if (!result.success) {
        toast.error(result.message || t('Failed to save affiliate profile'))
        return
      }
      toast.success(t('Affiliate profile saved'))
      setFormValues(EMPTY_FORM)
      setPage(1)
      await profilesQuery.refetch()
    },
    onError: () => toast.error(t('Failed to save affiliate profile')),
  })

  const statusMutation = useMutation({
    mutationFn: (args: {
      profile: AffiliateProfile
      status: 'active' | 'disabled'
    }) =>
      updateAffiliateProfileStatus(
        args.profile.user_id,
        args.status,
        args.status === 'active'
          ? t('Admin enabled affiliate profile in affiliate management')
          : t('Admin disabled affiliate profile in affiliate management')
      ),
    onSuccess: async (result) => {
      if (!result.success) {
        toast.error(result.message || t('Failed to update affiliate status'))
        return
      }
      toast.success(t('Affiliate status updated'))
      await profilesQuery.refetch()
    },
    onError: () => toast.error(t('Failed to update affiliate status')),
  })

  const saveRuleSetMutation = useMutation({
    mutationFn: saveAffiliateRuleSetDraft,
    onSuccess: async (result) => {
      if (!result.success) {
        toast.error(result.message || t('Failed to save affiliate rule set'))
        return
      }
      toast.success(t('Affiliate rule set draft saved'))
      const nextValues = buildAffiliateRuleSetDraftFormValues(result.data)
      setRuleSetFormValues(nextValues)
      setRuleSetBaselineValues(nextValues)
      setRuleSetReadOnly(isAffiliateRuleSetReadOnly(result.data))
      setRuleSetPage(1)
      await ruleSetsQuery.refetch()
    },
    onError: () => toast.error(t('Failed to save affiliate rule set')),
  })

  const ruleSetStatusMutation = useMutation({
    mutationFn: (args: {
      ruleSet: AffiliateRuleSet
      action: 'publish' | 'archive'
    }) =>
      updateAffiliateRuleSetStatus(
        args.ruleSet.id,
        args.action,
        buildAffiliateRuleSetStatusPayload(
          args.action === 'publish'
            ? t('Admin published affiliate rule set in affiliate management')
            : t('Admin archived affiliate rule set in affiliate management')
        ).reason
      ),
    onSuccess: async (result) => {
      if (!result.success) {
        toast.error(result.message || t('Failed to update affiliate rule set'))
        return
      }
      toast.success(t('Affiliate rule set updated'))
      const nextValues = buildAffiliateRuleSetDraftFormValues(result.data)
      setRuleSetFormValues(nextValues)
      setRuleSetBaselineValues(nextValues)
      setRuleSetReadOnly(isAffiliateRuleSetReadOnly(result.data))
      await ruleSetsQuery.refetch()
    },
    onError: () => toast.error(t('Failed to update affiliate rule set')),
  })

  const rollbackRuleSetMutation = useMutation({
    mutationFn: (ruleSet: AffiliateRuleSet) =>
      rollbackAffiliateRuleSetToDraft(
        ruleSet.id,
        buildAffiliateRuleSetRollbackPayload(ruleSet, t)
      ),
    onSuccess: async (result) => {
      if (!result.success) {
        toast.error(
          result.message ||
            t('Failed to create affiliate rule set rollback draft')
        )
        return
      }
      toast.success(t('Affiliate rule set rollback draft created'))
      const nextValues = buildAffiliateRuleSetDraftFormValues(result.data)
      setRuleSetFormValues(nextValues)
      setRuleSetBaselineValues(nextValues)
      setRuleSetReadOnly(false)
      setRuleSetPage(1)
      await ruleSetsQuery.refetch()
    },
    onError: () =>
      toast.error(t('Failed to create affiliate rule set rollback draft')),
  })

  const settlementRunMutation = useMutation({
    mutationFn: runAffiliateSettlementPipeline,
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.message || t('Failed to run settlement pipeline'))
        return
      }
      const data = result.data
      setLastFinanceResult(
        t(
          'Settlement pipeline completed: KPI {{kpi}}, commission {{commission}}, head fee {{headFee}}, settlements {{settlement}}'
        )
          .replace('{{kpi}}', String(data?.kpi_snapshot_count || 0))
          .replace('{{commission}}', String(data?.commission_event_count || 0))
          .replace('{{headFee}}', String(data?.head_fee_event_count || 0))
          .replace('{{settlement}}', String(data?.settlement_count || 0))
      )
      toast.success(t('Settlement pipeline completed'))
    },
    onError: () => toast.error(t('Failed to run settlement pipeline')),
  })

  const commissionRecomputeMutation = useMutation({
    mutationFn: recomputeAffiliateCommissions,
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.message || t('Failed to recompute commissions'))
        return
      }
      const data = result.data
      setLastFinanceResult(
        t(
          'Commission recompute completed: voided {{voided}}, created {{created}}'
        )
          .replace('{{voided}}', String(data?.voided_event_count || 0))
          .replace('{{created}}', String(data?.created_event_count || 0))
      )
      toast.success(t('Commission recompute completed'))
    },
    onError: () => toast.error(t('Failed to recompute commissions')),
  })

  const commissionAdjustmentMutation = useMutation({
    mutationFn: createAffiliateCommissionAdjustment,
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(
          result.message || t('Failed to create commission adjustment')
        )
        return
      }
      setLastFinanceResult(
        t('Commission adjustment created: {{amount}}').replace(
          '{{amount}}',
          formatAffiliateCentsRMB(result.data?.commission_cents)
        )
      )
      toast.success(t('Commission adjustment created'))
    },
    onError: () => toast.error(t('Failed to create commission adjustment')),
  })

  const handleSave = () => {
    const payload = buildAffiliateProfilePayload(formValues)
    const validationError = validateAffiliateProfilePayload(payload, t)
    if (validationError) {
      toast.error(validationError)
      return
    }
    saveMutation.mutate(payload)
  }

  const handleSaveRuleSet = () => {
    if (ruleSetReadOnly) {
      toast.error(t('Published and archived rule sets are read-only'))
      return
    }
    let payload
    try {
      payload = buildAffiliateRuleSetDraftPayload(ruleSetFormValues)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Rule JSON is invalid')
      )
      return
    }
    const validationError = validateAffiliateRuleSetDraftPayload(payload, t)
    if (validationError) {
      toast.error(validationError)
      return
    }
    if (payload.id > 0) {
      const message = buildAffiliateRuleSetSaveConfirmation(
        { id: payload.id, version: payload.version },
        t
      )
      if (typeof window !== 'undefined' && !window.confirm(message)) return
    }
    saveRuleSetMutation.mutate(payload)
  }

  const handleSettlementRun = () => {
    const payload = buildAffiliateSettlementRunPayload(settlementRunValues)
    const validationError = validateAffiliateSettlementRunPayload(payload, t)
    if (validationError) {
      toast.error(validationError)
      return
    }
    settlementRunMutation.mutate(payload)
  }

  const handleCommissionRecompute = () => {
    const payload = buildAffiliateCommissionRecomputePayload(
      commissionRecomputeValues
    )
    const validationError = validateAffiliateCommissionRecomputePayload(
      payload,
      t
    )
    if (validationError) {
      toast.error(validationError)
      return
    }
    commissionRecomputeMutation.mutate(payload)
  }

  const handleCommissionAdjustment = () => {
    const payload = buildAffiliateCommissionAdjustmentPayload(
      commissionAdjustmentValues
    )
    const validationError = validateAffiliateCommissionAdjustmentPayload(
      payload,
      t
    )
    if (validationError) {
      toast.error(validationError)
      return
    }
    commissionAdjustmentMutation.mutate(payload)
  }

  const applyFilters = () => {
    setFilters({ ...draftFilters })
    setPage(1)
  }

  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS)
    setFilters(EMPTY_FILTERS)
    setPage(1)
  }

  const applyRuleSetFilters = () => {
    setRuleSetFilters({ ...draftRuleSetFilters })
    setRuleSetPage(1)
  }

  const resetRuleSetFilters = () => {
    setDraftRuleSetFilters(EMPTY_RULE_FILTERS)
    setRuleSetFilters(EMPTY_RULE_FILTERS)
    setRuleSetPage(1)
  }

  const newRuleSetDraft = () => {
    const nextValues = buildAffiliateRuleSetDraftFormValues()
    setRuleSetFormValues(nextValues)
    setRuleSetBaselineValues(nextValues)
    setRuleSetReadOnly(false)
  }

  const copyRuleSetDraft = (ruleSet: AffiliateRuleSet) => {
    setRuleSetFormValues(buildAffiliateRuleSetCopyDraftFormValues(ruleSet))
    setRuleSetBaselineValues(buildAffiliateRuleSetDraftFormValues(ruleSet))
    setRuleSetReadOnly(false)
  }

  const handleRuleSetStatusChange = (
    ruleSet: AffiliateRuleSet,
    action: 'publish' | 'archive'
  ) => {
    const message = buildAffiliateRuleSetStatusConfirmation(action, ruleSet, t)
    if (typeof window !== 'undefined' && !window.confirm(message)) return
    ruleSetStatusMutation.mutate({ ruleSet, action })
  }

  const handleRuleSetRollback = (ruleSet: AffiliateRuleSet) => {
    const message = buildAffiliateRuleSetRollbackConfirmation(ruleSet, t)
    if (typeof window !== 'undefined' && !window.confirm(message)) return
    rollbackRuleSetMutation.mutate(ruleSet)
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Affiliate Management')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          variant='outline'
          disabled={profilesQuery.isFetching}
          onClick={() => void profilesQuery.refetch()}
        >
          <RefreshCw className='size-4' />
          {t('Refresh')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='space-y-4'>
          <ProfileForm
            values={formValues}
            setValues={setFormValues}
            isSaving={saveMutation.isPending}
            onSubmit={handleSave}
          />
          <FiltersForm
            draftFilters={draftFilters}
            setDraftFilters={setDraftFilters}
            disabled={profilesQuery.isFetching}
            onApply={applyFilters}
            onReset={resetFilters}
          />
          <ProfilesTable
            profiles={profilesQuery.data?.items ?? []}
            total={profilesQuery.data?.total ?? 0}
            page={page}
            pageSize={pageSize}
            isLoading={profilesQuery.isLoading || profilesQuery.isFetching}
            isMutating={statusMutation.isPending}
            onStatusChange={(profile, status) =>
              statusMutation.mutate({ profile, status })
            }
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize)
              setPage(1)
            }}
          />
          <RuleSetFiltersForm
            draftFilters={draftRuleSetFilters}
            setDraftFilters={setDraftRuleSetFilters}
            disabled={ruleSetsQuery.isFetching}
            onApply={applyRuleSetFilters}
            onReset={resetRuleSetFilters}
          />
          <RuleSetsTable
            ruleSets={ruleSetsQuery.data?.items ?? []}
            total={ruleSetsQuery.data?.total ?? 0}
            page={ruleSetPage}
            pageSize={ruleSetPageSize}
            isLoading={ruleSetsQuery.isLoading || ruleSetsQuery.isFetching}
            isMutating={
              ruleSetStatusMutation.isPending ||
              rollbackRuleSetMutation.isPending
            }
            onEdit={(ruleSet) => {
              const nextValues = buildAffiliateRuleSetDraftFormValues(ruleSet)
              setRuleSetFormValues(nextValues)
              setRuleSetBaselineValues(nextValues)
              setRuleSetReadOnly(isAffiliateRuleSetReadOnly(ruleSet))
            }}
            onCopy={copyRuleSetDraft}
            onRollback={handleRuleSetRollback}
            onStatusChange={handleRuleSetStatusChange}
            onPageChange={setRuleSetPage}
            onPageSizeChange={(nextPageSize) => {
              setRuleSetPageSize(nextPageSize)
              setRuleSetPage(1)
            }}
          />
          <RuleSetDraftForm
            values={ruleSetFormValues}
            baselineValues={ruleSetBaselineValues}
            setValues={setRuleSetFormValues}
            isSaving={saveRuleSetMutation.isPending}
            readOnly={ruleSetReadOnly}
            onSubmit={handleSaveRuleSet}
            onNew={newRuleSetDraft}
          />
          <FinanceOperationsPanel
            settlementRunValues={settlementRunValues}
            setSettlementRunValues={setSettlementRunValues}
            commissionRecomputeValues={commissionRecomputeValues}
            setCommissionRecomputeValues={setCommissionRecomputeValues}
            commissionAdjustmentValues={commissionAdjustmentValues}
            setCommissionAdjustmentValues={setCommissionAdjustmentValues}
            lastResult={lastFinanceResult}
            onSettlementRun={handleSettlementRun}
            onCommissionRecompute={handleCommissionRecompute}
            onCommissionAdjustment={handleCommissionAdjustment}
            isSettlementRunSaving={settlementRunMutation.isPending}
            isCommissionRecomputeSaving={commissionRecomputeMutation.isPending}
            isCommissionAdjustmentSaving={
              commissionAdjustmentMutation.isPending
            }
          />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
