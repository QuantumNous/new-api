/*
Copyright (C) 2023-2026 QuantumNous
*/
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PartnerOAuthClientFormDialog } from '../components/client-form-dialog'
import { partnerOAuthClientFormSchema } from '../types'

describe('partner OAuth client form', () => {
  it('rejects an empty name and missing redirect URIs', () => {
    const empty = partnerOAuthClientFormSchema.safeParse({
      name: '  ',
      token_auth_method: 'client_secret_basic',
      redirect_uris: '',
      scopes: [],
    })
    expect(empty.success).toBe(false)

    const valid = partnerOAuthClientFormSchema.safeParse({
      name: 'Assistant',
      token_auth_method: 'none',
      redirect_uris: 'https://assistant.example.com/oauth/callback',
      scopes: ['account:read', 'credential:read'],
    })
    expect(valid.success).toBe(true)
  })

  it('shows validation errors when the create form is submitted empty', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <PartnerOAuthClientFormDialog
        open
        onOpenChange={() => undefined}
        onSubmit={onSubmit}
      />
    )
    await user.clear(screen.getByLabelText('Application name'))
    await user.clear(screen.getByLabelText('Redirect URIs'))
    await user.click(screen.getByRole('button', { name: 'Create' }))
    expect(await screen.findByText('Name is required')).toBeVisible()
    expect(screen.getByText('Add at least one redirect URI')).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
