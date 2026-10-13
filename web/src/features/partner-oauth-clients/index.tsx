/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { SectionPageLayout } from '@/components/layout/components/section-page-layout'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import {
  SecureVerificationDialog,
  useSecureVerification,
} from '@/features/auth/secure-verification'
import {
  ADMIN_PERMISSION_ACTIONS,
  ADMIN_PERMISSION_RESOURCES,
  hasPermission,
} from '@/lib/admin-permissions'
import { handleServerError } from '@/lib/handle-server-error'
import { useAuthStore } from '@/stores/auth-store'

import {
  createPartnerOAuthClient,
  deletePartnerOAuthClient,
  listPartnerOAuthClients,
  rotatePartnerOAuthClientSecret,
  updatePartnerOAuthClient,
  updatePartnerOAuthClientStatus,
} from './api'
import { PartnerOAuthClientFormDialog } from './components/client-form-dialog'
import { PartnerOAuthClientSecretDialog } from './components/client-secret-dialog'
import { PartnerOAuthClientsTable } from './components/clients-table'
import {
  parseRedirectURIs,
  type PartnerOAuthClient,
  type PartnerOAuthClientFormValues,
} from './types'

const clientsQueryKey = ['admin', 'partner-oauth-clients'] as const

export function PartnerOAuthClients() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const queryClient = useQueryClient()
  const verification = useSecureVerification()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PartnerOAuthClient | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PartnerOAuthClient | null>(
    null
  )
  const [rotateTarget, setRotateTarget] = useState<PartnerOAuthClient | null>(
    null
  )
  const [revealedSecret, setRevealedSecret] = useState<{
    clientId: string
    secret: string
  } | null>(null)

  const canWrite = hasPermission(
    user,
    ADMIN_PERMISSION_RESOURCES.PARTNER_OAUTH_CLIENT,
    ADMIN_PERMISSION_ACTIONS.SENSITIVE_WRITE
  )
  const canOperate = hasPermission(
    user,
    ADMIN_PERMISSION_RESOURCES.PARTNER_OAUTH_CLIENT,
    ADMIN_PERMISSION_ACTIONS.OPERATE
  )

  const clientsQuery = useQuery({
    queryKey: clientsQueryKey,
    queryFn: listPartnerOAuthClients,
  })

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: clientsQueryKey })

  const createMutation = useMutation({
    mutationFn: async (values: PartnerOAuthClientFormValues) => {
      const proof = await verification.requestVerification({
        scope: 'partner_oauth.client.sensitive_write',
        context: { action: 'create' },
        title: t('Verify to create a partner OAuth client'),
      })
      if (!proof) throw new Error('verification cancelled')
      return createPartnerOAuthClient(
        {
          name: values.name,
          token_auth_method: values.token_auth_method,
          redirect_uris: parseRedirectURIs(values.redirect_uris),
          scopes: values.scopes,
        },
        proof.proof_token
      )
    },
    onSuccess: async (client) => {
      setFormOpen(false)
      if (client.client_secret) {
        setRevealedSecret({
          clientId: client.client_id,
          secret: client.client_secret,
        })
      }
      toast.success(t('Partner OAuth client created'))
      await refresh()
    },
    onError: (error: Error) => {
      if (error.message === 'verification cancelled') return
      handleServerError(error)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (values: PartnerOAuthClientFormValues) => {
      if (!editing) throw new Error('missing client')
      const proof = await verification.requestVerification({
        scope: 'partner_oauth.client.sensitive_write',
        context: { action: 'update', client_id: editing.client_id },
        title: t('Verify to update this partner OAuth client'),
      })
      if (!proof) throw new Error('verification cancelled')
      return updatePartnerOAuthClient(
        editing.id,
        {
          name: values.name,
          redirect_uris: parseRedirectURIs(values.redirect_uris),
          scopes: values.scopes,
        },
        proof.proof_token
      )
    },
    onSuccess: async () => {
      setEditing(null)
      setFormOpen(false)
      toast.success(t('Partner OAuth client updated'))
      await refresh()
    },
    onError: (error: Error) => {
      if (error.message === 'verification cancelled') return
      handleServerError(error)
    },
  })

  const statusMutation = useMutation({
    mutationFn: (client: PartnerOAuthClient) =>
      updatePartnerOAuthClientStatus(client.id, client.status === 1 ? 2 : 1),
    onSuccess: async () => {
      toast.success(t('Partner OAuth client status updated'))
      await refresh()
    },
    onError: (error: Error) => handleServerError(error),
  })

  const rotateMutation = useMutation({
    mutationFn: async (client: PartnerOAuthClient) => {
      const proof = await verification.requestVerification({
        scope: 'partner_oauth.client.sensitive_write',
        context: { action: 'rotate_secret', client_id: client.client_id },
        title: t('Verify to rotate the client secret'),
      })
      if (!proof) throw new Error('verification cancelled')
      return rotatePartnerOAuthClientSecret(client.id, proof.proof_token)
    },
    onSuccess: async (client) => {
      setRotateTarget(null)
      if (client.client_secret) {
        setRevealedSecret({
          clientId: client.client_id,
          secret: client.client_secret,
        })
      }
      toast.success(t('Client secret rotated'))
      await refresh()
    },
    onError: (error: Error) => {
      if (error.message === 'verification cancelled') return
      handleServerError(error)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (client: PartnerOAuthClient) => {
      const proof = await verification.requestVerification({
        scope: 'partner_oauth.client.sensitive_write',
        context: { action: 'delete', client_id: client.client_id },
        title: t('Verify to delete this partner OAuth client'),
      })
      if (!proof) throw new Error('verification cancelled')
      return deletePartnerOAuthClient(client.id, proof.proof_token)
    },
    onSuccess: async () => {
      setDeleteTarget(null)
      toast.success(t('Partner OAuth client deleted'))
      await refresh()
    },
    onError: (error: Error) => {
      if (error.message === 'verification cancelled') return
      handleServerError(error)
    },
  })

  let content
  if (clientsQuery.isLoading) {
    content = <Skeleton className='h-48 w-full' />
  } else if (clientsQuery.isError) {
    content = (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{t('Failed to load partner OAuth clients')}</EmptyTitle>
          <EmptyDescription>
            {t('Refresh the list and try again.')}
          </EmptyDescription>
        </EmptyHeader>
        <Button
          type='button'
          variant='outline'
          onClick={() => clientsQuery.refetch()}
        >
          {t('Retry')}
        </Button>
      </Empty>
    )
  } else {
    content = (
      <PartnerOAuthClientsTable
        clients={clientsQuery.data ?? []}
        canWrite={canWrite}
        canOperate={canOperate}
        onCreate={() => {
          setEditing(null)
          setFormOpen(true)
        }}
        onEdit={(client) => {
          setEditing(client)
          setFormOpen(true)
        }}
        onToggle={(client) => statusMutation.mutate(client)}
        onRotate={setRotateTarget}
        onDelete={setDeleteTarget}
      />
    )
  }

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>
          {t('Partner OAuth Clients')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='mx-auto w-full max-w-7xl space-y-4'>{content}</div>
        </SectionPageLayout.Content>
      </SectionPageLayout>
      <PartnerOAuthClientFormDialog
        open={formOpen}
        client={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditing(null)
        }}
        onSubmit={(values) => {
          if (editing) {
            updateMutation.mutate(values)
            return
          }
          createMutation.mutate(values)
        }}
      />
      <PartnerOAuthClientSecretDialog
        open={!!revealedSecret}
        clientId={revealedSecret?.clientId ?? ''}
        secret={revealedSecret?.secret ?? ''}
        onOpenChange={(open) => {
          if (!open) setRevealedSecret(null)
        }}
      />
      <ConfirmDialog
        open={!!rotateTarget}
        onOpenChange={(open) => {
          if (!open) setRotateTarget(null)
        }}
        title={t('Rotate client secret?')}
        desc={t(
          'The current secret stops working immediately. Copy the new secret when it appears.'
        )}
        confirmText={t('Rotate secret')}
        handleConfirm={() => {
          if (rotateTarget) rotateMutation.mutate(rotateTarget)
        }}
        isLoading={rotateMutation.isPending}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={t('Delete partner OAuth client?')}
        desc={t(
          'This revokes every active binding and disables the issued API keys.'
        )}
        confirmText={t('Delete')}
        destructive
        handleConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget)
        }}
        isLoading={deleteMutation.isPending}
      />
      <SecureVerificationDialog {...verification.dialogProps} />
    </>
  )
}
