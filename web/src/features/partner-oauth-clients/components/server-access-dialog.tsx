/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Dialog } from '@/components/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { RequestVerificationOptions } from '@/features/auth/secure-verification/types'
import { getGroups } from '@/features/users/api'
import { handleServerError } from '@/lib/handle-server-error'
import { requireServerSuccess } from '@/lib/server-error-message'

import {
  getPartnerServerConfig,
  issuePartnerServerSecret,
  revokePartnerServerKeys,
  revokePartnerServerSecret,
  updatePartnerServerConfig,
} from '../api'
import {
  parseIPAllowlist,
  type PartnerOAuthClient,
  type PartnerServerConfigFormValues,
  type PartnerServerSecret,
} from '../types'
import { PartnerOAuthClientSecretDialog } from './client-secret-dialog'
import { PartnerServerAccountsPanel } from './server-accounts-panel'
import { PartnerServerSecretsPanel } from './server-secrets-panel'
import { PartnerServerSettingsForm } from './server-settings-form'

const VERIFICATION_CANCELLED = 'verification cancelled'

export function PartnerServerAccessDialog(props: {
  client: PartnerOAuthClient | null
  canWrite: boolean
  requestVerification: (
    options: RequestVerificationOptions
  ) => Promise<{ proof_token: string } | null>
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const client = props.client
  const [revealed, setRevealed] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<PartnerServerSecret | null>(
    null
  )
  const [revokeAllOpen, setRevokeAllOpen] = useState(false)
  const configQueryKey = ['admin', 'partner-server', client?.id] as const

  const configQuery = useQuery({
    queryKey: configQueryKey,
    queryFn: () => getPartnerServerConfig(client?.id ?? 0),
    enabled: !!client,
  })
  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: async () => requireServerSuccess(await getGroups()),
    staleTime: 5 * 60 * 1000,
    enabled: !!client,
  })

  const verify = async (
    context: Extract<
      RequestVerificationOptions,
      { scope: 'partner_oauth.client.sensitive_write' }
    >['context'],
    title: string
  ) => {
    const proof = await props.requestVerification({
      scope: 'partner_oauth.client.sensitive_write',
      context,
      title,
    })
    if (!proof) throw new Error(VERIFICATION_CANCELLED)
    return proof.proof_token
  }
  const onError = (error: Error) => {
    if (error.message === VERIFICATION_CANCELLED) return
    handleServerError(error)
  }
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: configQueryKey })

  const saveMutation = useMutation({
    mutationFn: async (values: PartnerServerConfigFormValues) => {
      if (!client) throw new Error('missing client')
      const proof = await verify(
        { action: 'update_server', client_id: client.client_id },
        t('Verify to change server access')
      )
      return updatePartnerServerConfig(
        client.id,
        {
          enabled: values.enabled,
          account_group: values.account_group,
          ip_allowlist: parseIPAllowlist(values.ip_allowlist),
          max_accounts: values.max_accounts,
          accounts_per_minute: values.accounts_per_minute,
        },
        proof
      )
    },
    onSuccess: async () => {
      toast.success(t('Server access settings saved'))
      await refresh()
    },
    onError,
  })
  const issueMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('missing client')
      const proof = await verify(
        { action: 'issue_server_secret', client_id: client.client_id },
        t('Verify to issue a server secret')
      )
      return issuePartnerServerSecret(client.id, proof)
    },
    onSuccess: async (issued) => {
      setRevealed(issued.value)
      await refresh()
    },
    onError,
  })
  const revokeMutation = useMutation({
    mutationFn: async (secret: PartnerServerSecret) => {
      if (!client) throw new Error('missing client')
      const proof = await verify(
        {
          action: 'revoke_server_secret',
          client_id: client.client_id,
          secret_id: secret.id,
        },
        t('Verify to revoke this server secret')
      )
      return revokePartnerServerSecret(client.id, secret.id, proof)
    },
    onSuccess: async () => {
      setRevokeTarget(null)
      toast.success(t('Server secret revoked'))
      await refresh()
    },
    onError,
  })
  const revokeAllMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('missing client')
      const proof = await verify(
        { action: 'revoke_server_keys', client_id: client.client_id },
        t('Verify to revoke every sub-account key')
      )
      return revokePartnerServerKeys(client.id, proof)
    },
    onSuccess: async () => {
      setRevokeAllOpen(false)
      toast.success(t('Key revocation started'))
      await refresh()
    },
    onError,
  })

  const busy =
    issueMutation.isPending ||
    revokeMutation.isPending ||
    revokeAllMutation.isPending

  let body = <Skeleton className='h-64 w-full' />
  if (configQuery.data && client) {
    body = (
      <Tabs defaultValue='settings'>
        <TabsList>
          <TabsTrigger value='settings'>{t('Settings')}</TabsTrigger>
          <TabsTrigger value='secrets'>{t('Secrets')}</TabsTrigger>
          <TabsTrigger value='accounts'>
            {t('Sub-accounts ({{total}})', {
              total: configQuery.data.account_count,
            })}
          </TabsTrigger>
        </TabsList>
        <TabsContent value='settings' className='pt-4'>
          <PartnerServerSettingsForm
            config={configQuery.data}
            groups={groupsQuery.data?.data ?? []}
            canWrite={props.canWrite}
            submitting={saveMutation.isPending}
            onSubmit={(values) => saveMutation.mutate(values)}
          />
        </TabsContent>
        <TabsContent value='secrets' className='pt-4'>
          <PartnerServerSecretsPanel
            config={configQuery.data}
            canWrite={props.canWrite}
            busy={busy}
            onIssue={() => issueMutation.mutate()}
            onRevoke={setRevokeTarget}
            onRevokeAllKeys={() => setRevokeAllOpen(true)}
          />
        </TabsContent>
        <TabsContent value='accounts' className='pt-4'>
          <PartnerServerAccountsPanel clientId={client.id} />
        </TabsContent>
      </Tabs>
    )
  }

  return (
    <>
      <Dialog
        open={!!client}
        onOpenChange={props.onOpenChange}
        title={t('Server access: {{name}}', { name: client?.name ?? '' })}
        description={t(
          'The partner backend uses a server secret to create sub-accounts, issue keys and take payments for its users.'
        )}
        contentClassName='sm:max-w-3xl'
      >
        {body}
      </Dialog>
      <PartnerOAuthClientSecretDialog
        open={!!revealed}
        clientId={client?.client_id ?? ''}
        secret={revealed ?? ''}
        secretLabel={t('Server secret')}
        onOpenChange={(open) => {
          if (!open) setRevealed(null)
        }}
      />
      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null)
        }}
        title={t('Revoke server secret?')}
        desc={t(
          'The secret and every access token issued with it stop working immediately.'
        )}
        confirmText={t('Revoke')}
        destructive
        handleConfirm={() => {
          if (revokeTarget) revokeMutation.mutate(revokeTarget)
        }}
        isLoading={revokeMutation.isPending}
      />
      <ConfirmDialog
        open={revokeAllOpen}
        onOpenChange={setRevokeAllOpen}
        title={t('Revoke all sub-account keys?')}
        desc={t(
          'Every key of this partner’s sub-accounts stops working. The partner must rotate each account to get a new key.'
        )}
        confirmText={t('Revoke all keys')}
        destructive
        handleConfirm={() => revokeAllMutation.mutate()}
        isLoading={revokeAllMutation.isPending}
      />
    </>
  )
}
