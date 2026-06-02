/*
Copyright (C) 2023-2026 QuantumNous

Integration regression test for the bug:
- User selects "Português" in the top nav menu
- i18next stores "pt" (the canonical code) in localStorage
- User navigates to /profile
- The <Select> showed "English" because normalizeInterfaceLanguage
  was case-sensitive: it lowercased the input to "pt" and then compared
  against option codes case-sensitively, but the options array uses
  mixed-case canonical codes. Fixed: the function now matches
  case-insensitively and returns the canonical mixed-case code.
*/
import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { LanguagePreferencesCard } from '../components/language-preferences-card'
import { loadI18n } from '../../../test/setup'

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({ auth: { user: { id: 1, username: 'giovanni' } } }),
}))
vi.mock('../api', () => ({
  updateUserLanguage: vi.fn(async () => ({ success: true })),
}))
vi.mock('../lib', () => ({
  parseUserSettings: (s?: Record<string, unknown> | null) => s ?? {},
}))

describe('LanguagePreferencesCard integration: case-insensitive normalize', () => {
  test('Select trigger shows "Português" when i18n.language is "pt"', async () => {
    // Simulate the user state: i18n.language is "pt" (the canonical code)
    const i18n = await loadI18n('pt')
    expect(i18n.language).toBe('pt')

    // Render the card. props.profile is null so the savedLanguage
    // falls back to i18n.language.
    render(
      <I18nextProvider i18n={i18n}>
        <LanguagePreferencesCard profile={null} onProfileUpdate={() => {}} />
      </I18nextProvider>,
    )

    // The select trigger should display the Portuguese option label,
    // NOT fall back to "English". Base UI's <Select.Trigger> renders
    // a <button role="combobox"> without an accessible name; query
    // by role and assert its visible text content.
    const selectTrigger = screen.getByRole('combobox')
    expect(selectTrigger).toHaveTextContent('Português')
  })
})
