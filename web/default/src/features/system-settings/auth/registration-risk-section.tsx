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
import { useMemo, useState } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOptionsBulk } from '../hooks/use-update-option'
import {
  buildRegistrationRiskOptionRequest,
  getRegistrationDomainBlocks,
  releaseRegistrationDomainBlock,
  type RegistrationDomainBlock,
  type RegistrationRiskReleaseAction,
  type RegistrationRiskSettingsForm,
} from './registration-risk-api'
import { RegistrationRiskDetailDialog } from './registration-risk-detail-dialog'
import { RegistrationRiskIncidentTable } from './registration-risk-incident-table'

const maxRegistrationDomainRiskWindowHours = 720
const maxRegistrationDomainRiskThreshold = 10000

const registrationRiskSchema = z.object({
  domainRiskEnabled: z.boolean(),
  windowHours: z
    .number()
    .int()
    .min(1)
    .max(maxRegistrationDomainRiskWindowHours),
  threshold: z.number().int().min(2).max(maxRegistrationDomainRiskThreshold),
  trustedDomains: z.string(),
  emailBlacklistPatterns: z.string(),
})

const incidentPageSize = 20

type RegistrationRiskSectionProps = {
  defaultValues: {
    domainRiskEnabled: boolean
    windowHours: number
    threshold: number
    trustedDomains: string[]
    emailBlacklistPatterns: string[]
  }
}

type PendingRelease = {
  block: RegistrationDomainBlock
  action: RegistrationRiskReleaseAction
}

export function RegistrationRiskSection(props: RegistrationRiskSectionProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const updateOptions = useUpdateOptionsBulk()
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null)
  const [incidentPage, setIncidentPage] = useState(1)
  const [pendingRelease, setPendingRelease] = useState<PendingRelease | null>(
    null
  )
  const formDefaults = useMemo<RegistrationRiskSettingsForm>(
    () => ({
      domainRiskEnabled: props.defaultValues.domainRiskEnabled,
      windowHours: props.defaultValues.windowHours,
      threshold: props.defaultValues.threshold,
      trustedDomains: props.defaultValues.trustedDomains.join('\n'),
      emailBlacklistPatterns:
        props.defaultValues.emailBlacklistPatterns.join('\n'),
    }),
    [props.defaultValues]
  )
  const form = useForm<RegistrationRiskSettingsForm>({
    resolver: zodResolver(registrationRiskSchema),
    defaultValues: formDefaults,
  })
  useResetForm(form, formDefaults)

  const incidentsQuery = useQuery({
    queryKey: ['registration-domain-risk', 'blocks', incidentPage],
    queryFn: () => getRegistrationDomainBlocks(incidentPage, incidentPageSize),
  })
  const incidents = incidentsQuery.data?.items ?? []
  const incidentPageCount = Math.max(
    1,
    Math.ceil((incidentsQuery.data?.total ?? 0) / incidentPageSize)
  )

  const releaseMutation = useMutation({
    mutationFn: (pending: PendingRelease) =>
      releaseRegistrationDomainBlock(pending.block.id, pending.action),
    onSuccess: async (_response, pending) => {
      setPendingRelease(null)
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['registration-domain-risk'],
        }),
        queryClient.invalidateQueries({ queryKey: ['system-options'] }),
      ])
      toast.success(
        pending.action === 'restore-and-trust'
          ? t('Users restored and domain added to trusted list')
          : t('Domain block released')
      )
    },
    onError: (error) => {
      toast.error(error.message || t('Failed to release domain block'))
    },
  })

  const onSubmit = async (values: RegistrationRiskSettingsForm) => {
    await updateOptions.mutateAsync(buildRegistrationRiskOptionRequest(values))
  }

  return (
    <SettingsSection title={t('Registration Domain Risk Control')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOptions.isPending}
          />
          <FormField
            control={form.control}
            name='domainRiskEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Domain registration rate limit')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Automatically block non-trusted domains that exceed the rolling registration threshold'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />
          <FormField
            control={form.control}
            name='windowHours'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Rolling window (hours)')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={1}
                    max={maxRegistrationDomainRiskWindowHours}
                    value={field.value}
                    onChange={(event) =>
                      field.onChange(Number(event.target.value))
                    }
                  />
                </FormControl>
                <FormDescription>
                  {t('Count registrations from the same domain in this period')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='threshold'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Registration threshold')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={2}
                    max={maxRegistrationDomainRiskThreshold}
                    value={field.value}
                    onChange={(event) =>
                      field.onChange(Number(event.target.value))
                    }
                  />
                </FormControl>
                <FormDescription>
                  {t('Reject the registration that reaches this count')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='trustedDomains'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Trusted email domains')}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={5}
                    placeholder={t('example.com&#10;company.com')}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'One exact domain per line; trusted domains bypass registration rate blocking'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='emailBlacklistPatterns'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Registration email blacklist')}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={5}
                    placeholder={'(?i)^fk[a-z0-9]{12}@[a-z0-9.]+$'}
                    className='font-mono'
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'One Go regular expression per line; matching email addresses cannot register'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>

      <div className='space-y-3 border-t pt-5'>
        <div>
          <h4 className='text-sm font-semibold'>
            {t('Domain block incidents')}
          </h4>
          <p className='text-muted-foreground text-xs'>
            {t(
              'Review affected accounts and quickly recover a false-positive block'
            )}
          </p>
        </div>
        {incidentsQuery.isLoading ? (
          <div className='text-muted-foreground flex min-h-28 items-center justify-center border-y text-sm'>
            {t('Loading domain incidents...')}
          </div>
        ) : incidentsQuery.isError ? (
          <div className='text-destructive flex min-h-28 items-center justify-center border-y text-sm'>
            {t('Failed to load domain incidents')}
          </div>
        ) : (
          <div className='space-y-3'>
            <RegistrationRiskIncidentTable
              incidents={incidents}
              onInspect={(block) => setSelectedBlockId(block.id)}
              onRecover={(block) =>
                setPendingRelease({ block, action: 'restore-and-trust' })
              }
              onReleaseOnly={(block) =>
                setPendingRelease({ block, action: 'release-only' })
              }
            />
            {incidentPageCount > 1 && (
              <div className='flex items-center justify-end gap-2'>
                <Button
                  type='button'
                  size='icon-sm'
                  variant='outline'
                  title={t('Previous')}
                  disabled={incidentPage <= 1}
                  onClick={() =>
                    setIncidentPage((page) => Math.max(1, page - 1))
                  }
                >
                  <ChevronLeft />
                  <span className='sr-only'>{t('Previous')}</span>
                </Button>
                <span className='text-muted-foreground min-w-16 text-center text-xs tabular-nums'>
                  {incidentPage} / {incidentPageCount}
                </span>
                <Button
                  type='button'
                  size='icon-sm'
                  variant='outline'
                  title={t('Next')}
                  disabled={incidentPage >= incidentPageCount}
                  onClick={() =>
                    setIncidentPage((page) =>
                      Math.min(incidentPageCount, page + 1)
                    )
                  }
                >
                  <ChevronRight />
                  <span className='sr-only'>{t('Next')}</span>
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <RegistrationRiskDetailDialog
        key={selectedBlockId ?? 'closed'}
        blockId={selectedBlockId}
        onOpenChange={(open) => {
          if (!open) setSelectedBlockId(null)
        }}
      />
      <ConfirmDialog
        open={pendingRelease?.action === 'restore-and-trust'}
        onOpenChange={(open) => {
          if (!open) setPendingRelease(null)
        }}
        title={t('Restore affected users and trust this domain?')}
        desc={t(
          'Only users disabled by this incident will be restored. The domain will be added to the trusted list and the block will be released.'
        )}
        confirmText={t('Restore and trust')}
        isLoading={releaseMutation.isPending}
        handleConfirm={() => {
          if (pendingRelease) releaseMutation.mutate(pendingRelease)
        }}
      />
      <ConfirmDialog
        open={pendingRelease?.action === 'release-only'}
        onOpenChange={(open) => {
          if (!open) setPendingRelease(null)
        }}
        title={t('Release this domain block only?')}
        desc={t(
          'The domain can register again, but affected users will remain disabled and the domain will not be trusted.'
        )}
        confirmText={t('Unblock only')}
        destructive
        isLoading={releaseMutation.isPending}
        handleConfirm={() => {
          if (pendingRelease) releaseMutation.mutate(pendingRelease)
        }}
      />
    </SettingsSection>
  )
}
