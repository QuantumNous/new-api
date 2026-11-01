/*
Copyright (C) 2023-2026 QuantumNous
*/
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PartnerOAuthClientsTable } from '../components/clients-table'
import type { PartnerOAuthClient } from '../types'

const client: PartnerOAuthClient = {
  id: 1,
  client_id: 'pc_abc',
  name: 'Example Assistant',
  token_auth_method: 'client_secret_basic',
  redirect_uris: ['https://assistant.example.com/oauth/callback'],
  scopes: ['account:read'],
  status: 1,
  created_at: 1,
  updated_at: 1,
}

describe('partner OAuth client permission gating', () => {
  it('hides write and operate actions when the viewer only has read', () => {
    render(
      <PartnerOAuthClientsTable
        clients={[client]}
        canWrite={false}
        canOperate={false}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onToggle={vi.fn()}
        onRotate={vi.fn()}
        onDelete={vi.fn()}
        onServerAccess={vi.fn()}
      />
    )
    expect(
      screen.queryByRole('button', { name: 'Create client' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Edit' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Disable' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Delete' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Server access' })).toBeVisible()
  })

  it('shows operate and write actions when those permissions are granted', () => {
    render(
      <PartnerOAuthClientsTable
        clients={[client]}
        canWrite
        canOperate
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onToggle={vi.fn()}
        onRotate={vi.fn()}
        onDelete={vi.fn()}
        onServerAccess={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Create client' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Disable' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Rotate secret' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeVisible()
  })
})
