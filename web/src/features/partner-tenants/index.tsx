/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { CopyButton } from '@/components/copy-button'
import { BadgeCell } from '@/components/data-table/core/badge-cell'
import { StaticDataTable } from '@/components/data-table/static/static-data-table'
import { Dialog } from '@/components/dialog'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  SecureVerificationDialog,
  useSecureVerification,
} from '@/features/auth/secure-verification'
import { getGroups } from '@/features/subscriptions/api'
import { handleServerError } from '@/lib/handle-server-error'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import {
  createPartnerTenant,
  listPartnerTenants,
  rotatePartnerTenantSecret,
  updatePartnerTenantStatus,
  type PartnerTenant,
} from './api'

const tenantsQueryKey = ['admin', 'partner-tenants'] as const

export function PartnerTenantsManager() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const isRoot = user?.role === ROLE.SUPER_ADMIN
  const queryClient = useQueryClient()
  const verification = useSecureVerification()
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [group, setGroup] = useState('')
  const [revealedSecret, setRevealedSecret] = useState('')
  const [statusTarget, setStatusTarget] = useState<PartnerTenant | null>(null)
  const [rotateTarget, setRotateTarget] = useState<PartnerTenant | null>(null)

  const tenantsQuery = useQuery({
    queryKey: tenantsQueryKey,
    queryFn: listPartnerTenants,
    enabled: isRoot,
  })
  const groupsQuery = useQuery({
    queryKey: ['admin', 'partner-tenant-groups'],
    queryFn: async () => {
      const response = await getGroups()
      if (!response.success) {
        throw new Error(response.message || 'Failed to load groups')
      }
      return response.data ?? []
    },
    enabled: createOpen,
  })

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: tenantsQueryKey })

  const createMutation = useMutation({
    mutationFn: async () => {
      const cleanName = name.trim()
      if (!cleanName || !group) {
        throw new Error('A name and dedicated model group are required')
      }
      const proof = await verification.requestVerification({
        scope: 'partner_tenant.sensitive_write',
        context: { action: 'create', group },
        title: t('Verify to create a partner tenant'),
      })
      if (!proof) throw new Error('verification cancelled')
      return createPartnerTenant({ name: cleanName, group }, proof.proof_token)
    },
    onSuccess: async (result) => {
      setCreateOpen(false)
      setName('')
      setGroup('')
      setRevealedSecret(result.secret)
      toast.success(t('Partner tenant created'))
      await refresh()
    },
    onError: (error: Error) => {
      if (error.message === 'verification cancelled') return
      handleServerError(error)
    },
  })

  const statusMutation = useMutation({
    mutationFn: (tenant: PartnerTenant) =>
      updatePartnerTenantStatus(tenant.id, tenant.status === 1 ? 2 : 1),
    onSuccess: async () => {
      setStatusTarget(null)
      toast.success(t('Partner tenant status updated'))
      await refresh()
    },
    onError: (error: Error) => handleServerError(error),
  })

  const rotateMutation = useMutation({
    mutationFn: async (tenant: PartnerTenant) => {
      const proof = await verification.requestVerification({
        scope: 'partner_tenant.sensitive_write',
        context: {
          action: 'rotate_secret',
          tenant_id: tenant.id,
        },
        title: t('Verify to rotate the partner server secret'),
      })
      if (!proof) throw new Error('verification cancelled')
      return rotatePartnerTenantSecret(tenant.id, proof.proof_token)
    },
    onSuccess: async ({ secret }) => {
      setRotateTarget(null)
      setRevealedSecret(secret)
      toast.success(t('Partner server secret rotated'))
      await refresh()
    },
    onError: (error: Error) => {
      if (error.message === 'verification cancelled') return
      handleServerError(error)
    },
  })

  if (!isRoot) return null

  const tenants = tenantsQuery.data ?? []
  const availableGroups = (groupsQuery.data ?? []).filter(
    (candidate) =>
      candidate !== 'default' &&
      candidate !== 'auto' &&
      !tenants.some((tenant) => tenant.group === candidate)
  )

  if (!isRoot) return null

  let content
  if (tenantsQuery.isLoading) {
    content = <Skeleton className='h-36 w-full' />
  } else if (tenantsQuery.isError) {
    content = (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{t('Failed to load partner tenants')}</EmptyTitle>
          <EmptyDescription>
            {t('Refresh the list and try again.')}
          </EmptyDescription>
        </EmptyHeader>
        <Button variant='outline' onClick={() => tenantsQuery.refetch()}>
          {t('Retry')}
        </Button>
      </Empty>
    )
  } else {
    content = (
      <StaticDataTable
        data={tenants}
        getRowKey={(tenant) => tenant.id}
        emptyContent={t('No partner tenants yet')}
        columns={[
          { id: 'name', header: t('Name'), cell: (tenant) => tenant.name },
          {
            id: 'group',
            header: t('Dedicated model group'),
            cell: (tenant) => (
              <span className='font-mono text-xs'>{tenant.group}</span>
            ),
          },
          {
            id: 'status',
            header: t('Status'),
            cell: (tenant) => (
              <BadgeCell>
                <StatusBadge
                  label={tenant.status === 1 ? t('Enabled') : t('Disabled')}
                  variant={tenant.status === 1 ? 'success' : 'neutral'}
                  copyable={false}
                />
              </BadgeCell>
            ),
          },
          {
            id: 'actions',
            header: t('Actions'),
            className: 'text-end',
            cell: (tenant) => (
              <div className='flex justify-end gap-1'>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  onClick={() => setStatusTarget(tenant)}
                >
                  {tenant.status === 1 ? t('Disable') : t('Enable')}
                </Button>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  onClick={() => setRotateTarget(tenant)}
                >
                  <RotateCw className='size-4' aria-hidden />
                  {t('Rotate secret')}
                </Button>
              </div>
            ),
          },
        ]}
      />
    )
  }

  return (
    <section className='space-y-3 border-b pb-5'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-sm font-semibold'>{t('Partner tenants')}</h2>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Each partner key is limited to its own accounts and dedicated model group.'
            )}
          </p>
        </div>
        <Button size='sm' onClick={() => setCreateOpen(true)}>
          <Plus className='size-4' aria-hidden />
          {t('Create partner tenant')}
        </Button>
      </div>
      {content}

      <Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t('Create partner tenant')}
        description={t(
          'A tenant receives one server secret and one dedicated model group.'
        )}
        contentClassName='sm:max-w-lg'
        footer={
          <>
            <Button
              type='button'
              variant='outline'
              onClick={() => setCreateOpen(false)}
            >
              {t('Cancel')}
            </Button>
            <Button
              type='button'
              disabled={createMutation.isPending || !name.trim() || !group}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? t('Creating...') : t('Create')}
            </Button>
          </>
        }
      >
        <div className='space-y-4'>
          <div className='space-y-1.5'>
            <Label htmlFor='partner-tenant-name'>{t('Partner name')}</Label>
            <Input
              id='partner-tenant-name'
              value={name}
              maxLength={64}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='partner-tenant-group'>
              {t('Dedicated model group')}
            </Label>
            <Select
              items={availableGroups.map((value) => ({ value, label: value }))}
              value={group}
              onValueChange={(value) => setGroup(value ?? '')}
              disabled={groupsQuery.isLoading || availableGroups.length === 0}
            >
              <SelectTrigger id='partner-tenant-group'>
                <SelectValue placeholder={t('Select a dedicated group')} />
              </SelectTrigger>
              <SelectContent>
                {availableGroups.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className='text-muted-foreground text-sm'>
              {t('A group can belong to only one partner tenant.')}
            </p>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={!!revealedSecret}
        onOpenChange={(open) => {
          if (!open) setRevealedSecret('')
        }}
        title={t('Partner server secret')}
        description={t(
          'Copy this secret now. It is shown once and cannot be retrieved later.'
        )}
        contentClassName='sm:max-w-lg'
        footer={
          <Button type='button' onClick={() => setRevealedSecret('')}>
            {t('Close')}
          </Button>
        }
      >
        <div className='space-y-3'>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Store it in the partner backend only. It can manage every account and subscription belonging to this partner.'
            )}
          </p>
          <div className='flex gap-2'>
            <Input readOnly value={revealedSecret} />
            <CopyButton value={revealedSecret} />
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!statusTarget}
        onOpenChange={(open) => {
          if (!open) setStatusTarget(null)
        }}
        title={t('Change partner tenant status?')}
        desc={t(
          'Disabling stops this server secret from managing accounts. Customer API keys remain enabled; subscription quota is unavailable after active plans expire.'
        )}
        confirmText={statusTarget?.status === 1 ? t('Disable') : t('Enable')}
        handleConfirm={() => {
          if (statusTarget) statusMutation.mutate(statusTarget)
        }}
        isLoading={statusMutation.isPending}
      />
      <ConfirmDialog
        open={!!rotateTarget}
        onOpenChange={(open) => {
          if (!open) setRotateTarget(null)
        }}
        title={t('Rotate partner secret?')}
        desc={t(
          'Rotating invalidates the old server secret immediately. Existing customer model keys remain active.'
        )}
        confirmText={t('Rotate secret')}
        handleConfirm={() => {
          if (rotateTarget) rotateMutation.mutate(rotateTarget)
        }}
        isLoading={rotateMutation.isPending}
      />
      <SecureVerificationDialog {...verification.dialogProps} />
    </section>
  )
}
