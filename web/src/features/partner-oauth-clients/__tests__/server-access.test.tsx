/*
Copyright (C) 2023-2026 QuantumNous
*/
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { PartnerServerAccessDialog } from '../components/server-access-dialog'
import { PartnerServerSecretsPanel } from '../components/server-secrets-panel'
import { PartnerServerSettingsForm } from '../components/server-settings-form'
import type { PartnerOAuthClient, PartnerServerConfig } from '../types'

const api = vi.hoisted(() => ({
  getPartnerServerConfig: vi.fn(),
  issuePartnerServerSecret: vi.fn(),
  listPartnerServerAccounts: vi.fn(),
}))

vi.mock('../api', () => ({
  getPartnerServerConfig: api.getPartnerServerConfig,
  issuePartnerServerSecret: api.issuePartnerServerSecret,
  listPartnerServerAccounts: api.listPartnerServerAccounts,
  updatePartnerServerConfig: vi.fn(),
  revokePartnerServerSecret: vi.fn(),
  revokePartnerServerKeys: vi.fn(),
}))

vi.mock('@/features/users/api', () => ({
  getGroups: vi.fn().mockResolvedValue({ success: true, data: ['default'] }),
}))

const client: PartnerOAuthClient = {
  id: 7,
  client_id: 'pc_0123456789abcdef0123456789abcdef',
  name: 'Kede Finance',
  token_auth_method: 'client_secret_basic',
  redirect_uris: ['https://partner.example.com/oauth/callback'],
  scopes: ['account:read'],
  status: 1,
  created_at: 1,
  updated_at: 1,
}

function config(
  overrides: Partial<PartnerServerConfig> = {}
): PartnerServerConfig {
  return {
    client_id: client.client_id,
    configured: true,
    enabled: true,
    account_group: 'default',
    ip_allowlist: [],
    max_accounts: 100000,
    accounts_per_minute: 60,
    suspended: false,
    account_count: 3,
    jobs: {
      suspension: { running: false, processed: 0 },
      key_revocation: { running: false, processed: 0 },
    },
    secrets: [],
    ...overrides,
  }
}

function withQueryClient(children: ReactNode) {
  return (
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      {children}
    </QueryClientProvider>
  )
}

describe('partner server settings form', () => {
  it('warns when no IP allowlist is configured', () => {
    render(
      <PartnerServerSettingsForm
        config={config()}
        groups={['default']}
        canWrite
        submitting={false}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByText('No IP allowlist')).toBeVisible()
  })

  it('hides the warning when an allowlist is configured', () => {
    render(
      <PartnerServerSettingsForm
        config={config({ ip_allowlist: ['203.0.113.5/32'] })}
        groups={['default']}
        canWrite
        submitting={false}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.queryByText('No IP allowlist')).not.toBeInTheDocument()
  })

  it('rejects an entry that is not an IP address or CIDR range', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <PartnerServerSettingsForm
        config={config()}
        groups={['default']}
        canWrite
        submitting={false}
        onSubmit={onSubmit}
      />
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Allowed source IPs' }),
      'partner.example.com'
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(
      await screen.findByText('Enter IP addresses or CIDR ranges, one per line')
    ).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits normalized values when the form is valid', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <PartnerServerSettingsForm
        config={config()}
        groups={['default']}
        canWrite
        submitting={false}
        onSubmit={onSubmit}
      />
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Allowed source IPs' }),
      '203.0.113.5'
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      enabled: true,
      account_group: 'default',
      ip_allowlist: '203.0.113.5',
    })
  })

  it('hides the save action for read-only viewers', () => {
    render(
      <PartnerServerSettingsForm
        config={config()}
        groups={['default']}
        canWrite={false}
        submitting={false}
        onSubmit={vi.fn()}
      />
    )
    expect(
      screen.queryByRole('button', { name: 'Save' })
    ).not.toBeInTheDocument()
  })
})

describe('partner server secrets panel', () => {
  it('disables issuing once two secrets are active', () => {
    render(
      <PartnerServerSecretsPanel
        config={config({
          secrets: [
            { id: 1, status: 'active', created_at: 1, revoked_at: 0 },
            { id: 2, status: 'active', created_at: 2, revoked_at: 0 },
          ],
        })}
        canWrite
        busy={false}
        onIssue={vi.fn()}
        onRevoke={vi.fn()}
        onRevokeAllKeys={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Issue secret' })).toBeDisabled()
  })

  it('offers revocation only for active secrets', async () => {
    const user = userEvent.setup()
    const onRevoke = vi.fn()
    render(
      <PartnerServerSecretsPanel
        config={config({
          secrets: [
            { id: 1, status: 'active', created_at: 1, revoked_at: 0 },
            { id: 2, status: 'revoked', created_at: 2, revoked_at: 3 },
          ],
        })}
        canWrite
        busy={false}
        onIssue={vi.fn()}
        onRevoke={onRevoke}
        onRevokeAllKeys={vi.fn()}
      />
    )
    const revokeButtons = screen.getAllByRole('button', { name: 'Revoke' })
    expect(revokeButtons).toHaveLength(1)
    await user.click(revokeButtons[0])
    expect(onRevoke).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, status: 'active' })
    )
  })

  it('disables revoking all keys when there are no sub-accounts', () => {
    render(
      <PartnerServerSecretsPanel
        config={config({ account_count: 0 })}
        canWrite
        busy={false}
        onIssue={vi.fn()}
        onRevoke={vi.fn()}
        onRevokeAllKeys={vi.fn()}
      />
    )
    expect(
      screen.getByRole('button', { name: 'Revoke all sub-account keys' })
    ).toBeDisabled()
  })
})

describe('partner server access dialog', () => {
  it('shows a newly issued secret once after verification', async () => {
    const user = userEvent.setup()
    api.getPartnerServerConfig.mockResolvedValue(config())
    api.issuePartnerServerSecret.mockResolvedValue({
      secret: { id: 9, status: 'active', created_at: 1, revoked_at: 0 },
      value: 'pss_issued_once',
    })
    const requestVerification = vi
      .fn()
      .mockResolvedValue({ proof_token: 'proof-1' })
    render(
      withQueryClient(
        <PartnerServerAccessDialog
          client={client}
          canWrite
          requestVerification={requestVerification}
          onOpenChange={vi.fn()}
        />
      )
    )

    await user.click(await screen.findByRole('tab', { name: 'Secrets' }))
    await user.click(screen.getByRole('button', { name: 'Issue secret' }))

    expect(await screen.findByDisplayValue('pss_issued_once')).toBeVisible()
    expect(requestVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'partner_oauth.client.sensitive_write',
        context: { action: 'issue_server_secret', client_id: client.client_id },
      })
    )
    expect(api.issuePartnerServerSecret).toHaveBeenCalledWith(7, 'proof-1')
  })

  it('does not issue a secret when verification is cancelled', async () => {
    const user = userEvent.setup()
    api.getPartnerServerConfig.mockResolvedValue(config())
    api.issuePartnerServerSecret.mockClear()
    render(
      withQueryClient(
        <PartnerServerAccessDialog
          client={client}
          canWrite
          requestVerification={vi.fn().mockResolvedValue(null)}
          onOpenChange={vi.fn()}
        />
      )
    )

    await user.click(await screen.findByRole('tab', { name: 'Secrets' }))
    await user.click(screen.getByRole('button', { name: 'Issue secret' }))

    await waitFor(() =>
      expect(api.issuePartnerServerSecret).not.toHaveBeenCalled()
    )
    expect(screen.queryByDisplayValue(/pss_/)).not.toBeInTheDocument()
  })
})
