import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../i18n'
import { LanguageSelect } from './language-select'

describe('LanguageSelect', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('sets selected language through the i18n context', async () => {
    render(
      <I18nProvider>
        <LanguageSelect />
      </I18nProvider>
    )

    const selector = screen.getByLabelText('Switch language')
    await userEvent.selectOptions(selector, 'ru')

    expect(selector).toHaveDisplayValue('Русский')
    expect(localStorage.getItem('vynex-lang')).toBe('ru')
  })
})
