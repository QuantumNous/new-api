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
  buildAffiliateProfilePayload,
  getAffiliateProfileLevelLabel,
  getAffiliateProfileStatusMeta,
  validateAffiliateProfilePayload,
} from './admin-lib'
import {
  getAffiliateProfiles,
  setAffiliateProfile,
  updateAffiliateProfileStatus,
} from './api'
import type {
  AffiliateProfile,
  AffiliateProfileFilters,
  AffiliateProfileFormValues,
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
        <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
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
        <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
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
          <div className='flex items-end gap-2'>
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
                    <TableCell>{profile.user_id}</TableCell>
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
                    <TableCell>{profile.invite_code || '-'}</TableCell>
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

export function AffiliateAdmin() {
  const { t } = useTranslation()
  const [formValues, setFormValues] =
    useState<AffiliateProfileFormValues>(EMPTY_FORM)
  const [filters, setFilters] = useState<AffiliateProfileFilters>(EMPTY_FILTERS)
  const [draftFilters, setDraftFilters] =
    useState<AffiliateProfileFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

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

  const handleSave = () => {
    const payload = buildAffiliateProfilePayload(formValues)
    const validationError = validateAffiliateProfilePayload(payload, t)
    if (validationError) {
      toast.error(validationError)
      return
    }
    saveMutation.mutate(payload)
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
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
