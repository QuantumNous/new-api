/*
Copyright (C) 2023-2026 QuantumNous
*/
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { listPartnerTenants } from '../api'
import { PartnerTenantsManager } from '../index'

const originalAuth = useAuthStore.getState().auth

vi.mock('../api', () => ({
  listPartnerTenants: vi.fn().mockResolvedValue([
    {
      id: 4,
      name: 'Partner A',
      group: 'partner-a',
      status: 1,
      created_at: 10,
      updated_at: 10,
    },
  ]),
  createPartnerTenant: vi.fn(),
  rotatePartnerTenantSecret: vi.fn(),
  updatePartnerTenantStatus: vi.fn(),
}))

vi.mock('@/features/subscriptions/api', () => ({
  getGroups: vi.fn().mockResolvedValue({
    success: true,
    data: ['default', 'partner-a', 'partner-b', 'auto'],
  }),
}))

vi.mock('@/features/auth/secure-verification', () => ({
  SecureVerificationDialog: () => null,
  useSecureVerification: () => ({
    requestVerification: vi.fn(),
    dialogProps: {},
  }),
}))

function renderManager() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <PartnerTenantsManager />
    </QueryClientProvider>
  )
}

describe('partner tenant management', () => {
  beforeEach(() => {
    useAuthStore.setState({
      auth: {
        ...originalAuth,
        user: { id: 1, username: 'root', role: ROLE.SUPER_ADMIN },
      },
    })
  })

  afterEach(() => {
    cleanup()
    useAuthStore.setState({ auth: originalAuth })
    vi.clearAllMocks()
  })

  it('shows each partner with its dedicated group', async () => {
    renderManager()

    expect(await screen.findByText('Partner A')).toBeVisible()
    expect(screen.getByText('partner-a')).toBeVisible()
    expect(vi.mocked(listPartnerTenants)).toHaveBeenCalledOnce()
  })

  it('offers only unused dedicated groups when creating a partner', async () => {
    const user = userEvent.setup()
    renderManager()
    await screen.findByText('Partner A')
    await user.click(
      screen.getByRole('button', { name: 'Create partner tenant' })
    )
    await screen.findByRole('dialog', { name: 'Create partner tenant' })
    await user.click(
      screen.getByRole('combobox', { name: 'Dedicated model group' })
    )

    const listbox = await screen.findByRole('listbox')
    expect(within(listbox).getByText('partner-b')).toBeVisible()
    expect(within(listbox).queryByText('partner-a')).not.toBeInTheDocument()
    expect(within(listbox).queryByText('default')).not.toBeInTheDocument()
    expect(within(listbox).queryByText('auto')).not.toBeInTheDocument()
  })

  it('does not expose tenant management to non-root administrators', () => {
    useAuthStore.setState({
      auth: {
        ...originalAuth,
        user: { id: 2, username: 'admin', role: ROLE.ADMIN },
      },
    })
    renderManager()

    expect(screen.queryByText('Partner tenants')).not.toBeInTheDocument()
    expect(listPartnerTenants).not.toHaveBeenCalled()
  })
})
