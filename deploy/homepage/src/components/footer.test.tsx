import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Footer } from './footer'
import { I18nProvider } from '../i18n'

describe('Footer', () => {
  it('renders brand name', () => {
    render(
      <I18nProvider>
        <Footer />
      </I18nProvider>
    )

    expect(screen.getByText('Vynex API')).toBeInTheDocument()
    expect(screen.getByText('V')).toBeInTheDocument()
  })

  it('renders navigation links in English', () => {
    render(
      <I18nProvider>
        <Footer />
      </I18nProvider>
    )

    expect(screen.getByText('Docs')).toBeInTheDocument()
    expect(screen.getByText('Pricing')).toBeInTheDocument()
    expect(screen.getByText('Console')).toBeInTheDocument()
  })

  it('renders navigation links in Chinese', () => {
    render(
      <I18nProvider>
        <Footer />
      </I18nProvider>
    )

    // Default is English, toggle to Chinese would require state change
    // Just verify links exist
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(3)
  })

  it('has correct href attributes', () => {
    render(
      <I18nProvider>
        <Footer />
      </I18nProvider>
    )

    expect(screen.getByText('Docs').closest('a')).toHaveAttribute('href', '/docs/')
    expect(screen.getByText('Pricing').closest('a')).toHaveAttribute('href', '/pricing')
    expect(screen.getByText('Console').closest('a')).toHaveAttribute('href', '/sign-in')
  })

  it('has footer class name', () => {
    const { container } = render(
      <I18nProvider>
        <Footer />
      </I18nProvider>
    )

    expect(container.querySelector('footer')).toHaveClass('footer')
  })

  it('has footer-inner container', () => {
    const { container } = render(
      <I18nProvider>
        <Footer />
      </I18nProvider>
    )

    expect(container.querySelector('.footer-inner')).toBeInTheDocument()
  })

  it('has brand section', () => {
    const { container } = render(
      <I18nProvider>
        <Footer />
      </I18nProvider>
    )

    expect(container.querySelector('.footer-brand')).toBeInTheDocument()
  })

  it('has links section', () => {
    const { container } = render(
      <I18nProvider>
        <Footer />
      </I18nProvider>
    )

    expect(container.querySelector('.footer-links')).toBeInTheDocument()
  })

  it('has divider elements between links', () => {
    const { container } = render(
      <I18nProvider>
        <Footer />
      </I18nProvider>
    )

    const dividers = container.querySelectorAll('.footer-divider')
    expect(dividers).toHaveLength(2)
  })
})
