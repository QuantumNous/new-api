import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuthLayout } from './auth-layout'
import { I18nProvider } from '../i18n'
import { Route, Router, Routes, createMemoryHistory } from 'react-router'

// Note: React Router v7 changed how routing works in tests
// We'll use MemoryRouter for simpler testing

describe('AuthLayout', () => {
  it('renders auth page container', () => {
    const { container } = render(
      <I18nProvider>
        <AuthLayout />
      </I18nProvider>
    )

    expect(container.querySelector('.auth-page')).toBeInTheDocument()
  })

  it('renders auth card', () => {
    const { container } = render(
      <I18nProvider>
        <AuthLayout />
      </I18nProvider>
    )

    expect(container.querySelector('.auth-card')).toBeInTheDocument()
  })

  it('renders brand name', () => {
    render(
      <I18nProvider>
        <AuthLayout />
      </I18nProvider>
    )

    expect(screen.getByText('Vynex API')).toBeInTheDocument()
  })

  it('renders brand mark', () => {
    render(
      <I18nProvider>
        <AuthLayout />
      </I18nProvider>
    )

    expect(screen.getByText('V')).toBeInTheDocument()
  })

  it('renders language toggle button', () => {
    render(
      <I18nProvider>
        <AuthLayout />
      </I18nProvider>
    )

    const langButton = screen.getByRole('button')
    expect(langButton).toHaveTextContent('中')
  })

  it('renders background grid element', () => {
    const { container } = render(
      <I18nProvider>
        <AuthLayout />
      </I18nProvider>
    )

    expect(container.querySelector('.auth-bg-grid')).toBeInTheDocument()
  })

  it('has auth-lang-toggle container', () => {
    const { container } = render(
      <I18nProvider>
        <AuthLayout />
      </I18nProvider>
    )

    expect(container.querySelector('.auth-lang-toggle')).toBeInTheDocument()
  })

  it('has auth-brand container', () => {
    const { container } = render(
      <I18nProvider>
        <AuthLayout />
      </I18nProvider>
    )

    expect(container.querySelector('.auth-brand')).toBeInTheDocument()
  })
})
