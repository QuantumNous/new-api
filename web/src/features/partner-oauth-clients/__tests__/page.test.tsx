/*
Copyright (C) 2023-2026 QuantumNous
*/
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PartnerOAuthClients } from '../index'

vi.mock('../api', () => ({
  listPartnerOAuthClients: vi.fn().mockResolvedValue([]),
  createPartnerOAuthClient: vi.fn(),
  updatePartnerOAuthClient: vi.fn(),
  rotatePartnerOAuthClientSecret: vi.fn(),
  updatePartnerOAuthClientStatus: vi.fn(),
  deletePartnerOAuthClient: vi.fn(),
}))

vi.mock('@/lib/admin-permissions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/admin-permissions')>()),
  hasPermission: () => true,
}))

describe('partner OAuth clients page', () => {
  it('opens the create dialog when the create button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PartnerOAuthClients />
      </QueryClientProvider>
    )

    await user.click(
      await screen.findByRole('button', { name: 'Create client' })
    )

    expect(
      await screen.findByRole('dialog', { name: 'Create partner OAuth client' })
    ).toBeVisible()
  })
})
