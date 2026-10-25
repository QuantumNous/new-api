/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { readFileSync } from 'node:fs'

import { QueryClient } from '@tanstack/react-query'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PRODUCT_NAME, PRODUCT_NAME_LATIN } from '@/lib/product-brand'
import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'
import { createTestAuthBundle } from '@/test-utils/auth-bundle'
import { renderApp } from '@/test-utils/render-app'

import { buildModelCatalog } from '../../lib/catalog'
import { CiLandingPage } from '../ci-landing-page'

let client: QueryClient
let style: HTMLStyleElement
const originalConfig = useSystemConfigStore.getState()
const originalAuth = useAuthStore.getState()
beforeEach(() => {
  useAuthStore.getState().auth.reset()
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  client.setQueryData(['status'], {}, { updatedAt: Date.now() + 60000 })
  style = document.createElement('style')
  document.head.append(style)
})
afterEach(() => {
  useSystemConfigStore.setState(originalConfig)
  useAuthStore.setState(originalAuth)
  client.clear()
  style.remove()
})
const models = buildModelCatalog(
  [
    {
      id: 1,
      model_name: 'test-model',
      quota_type: 0,
      model_ratio: 1,
      completion_ratio: 2,
      enable_groups: ['default'],
      group_ratio: { default: 1 },
    },
  ],
  1
)

describe('landing interactions and price layout', () => {
  it('keeps the hero brand in mark, product, and yeschoy capsule order', async () => {
    style.textContent = readFileSync(
      'src/features/home/components/home-glass.css',
      'utf8'
    )
    const { container } = await renderApp(
      <CiLandingPage
        isAuthenticated={false}
        models={models}
        maxSavingsPercent={0}
      />,
      client
    )

    const brand = container.querySelector('.ci-heroBrand')
    if (!brand) throw new Error('Missing hero brand')
    expect(brand.children).toHaveLength(3)
    expect(brand.children[0]).toHaveClass('ci-mark')
    expect(brand.children[1]).toHaveClass('ci-heroProductName')
    expect(brand.children[1]).toHaveTextContent(PRODUCT_NAME)
    expect(brand.children[2]).toHaveClass('ci-heroBrandBadge')
    expect(brand.children[2]).toHaveTextContent('yeschoy')

    const badge = brand.children[2]
    expect(getComputedStyle(badge).borderRadius).toBe('999px')
    expect(getComputedStyle(badge).color).toBe('var(--hero-body)')
    const landing = container.querySelector('.ci-liquidHome')
    const root = container.querySelector('.ci-handoffRoot')
    if (!landing || !root) throw new Error('Missing landing page')
    expect(getComputedStyle(root).getPropertyValue('--hero-canvas')).toBe(
      '#fcfdfe'
    )
    landing.setAttribute('data-theme', 'dark')
    expect(getComputedStyle(root).getPropertyValue('--hero-canvas')).toBe(
      '#080a0f'
    )

    const community = within(screen.getByRole('banner')).getByRole('button', {
      name: 'Community',
    })
    expect(community).toBeVisible()
    expect(community).toHaveClass('ci-communityTrigger')
    expect(readFileSync('src/styles/ci-landing.css', 'utf8')).toMatch(
      /\.ci-handoffRoot button\.ci-communityTrigger\s*{[^}]*color:\s*var\(--primary-foreground\)/
    )
  })

  it('offers the public cashback activity page from the home navigation', async () => {
    await renderApp(
      <CiLandingPage
        isAuthenticated={false}
        models={models}
        maxSavingsPercent={0}
      />,
      client
    )

    expect(
      within(
        screen.getByRole('navigation', { name: 'Main navigation' })
      ).getByRole('link', { name: 'Offers' })
    ).toHaveAttribute('href', '/activity')
  })

  it('shows the signed-in account menu and overview entry instead of sign-in links', async () => {
    const user = userEvent.setup()
    const bundle = createTestAuthBundle()
    useAuthStore.getState().auth.setBundle({
      ...bundle,
      user: { ...bundle.user, display_name: 'Demo User' },
    })
    await renderApp(
      <CiLandingPage isAuthenticated models={models} maxSavingsPercent={0} />,
      client
    )
    const header = screen.getByRole('banner')
    expect(
      within(header).getByRole('button', { name: 'Community' })
    ).toBeVisible()
    expect(
      within(header).queryByRole('link', { name: 'Sign in' })
    ).not.toBeInTheDocument()
    expect(
      within(header).queryByRole('link', { name: 'Start saving' })
    ).not.toBeInTheDocument()
    for (const link of within(header).getAllByRole('link', {
      name: 'Overview',
    })) {
      expect(link).toHaveAttribute('href', '/dashboard')
    }
    const avatar = within(header).getByRole('button', { name: 'Profile' })
    await user.click(avatar)
    expect(await screen.findByText('Demo User')).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Wallet' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeVisible()
    await user.keyboard('{Escape}')
    await user.click(
      within(header).getByRole('button', { name: 'Open navigation' })
    )
    const navigation = within(header).getByRole('navigation', {
      name: 'Main navigation',
    })
    expect(
      within(navigation).queryByRole('link', { name: 'Sign in' })
    ).not.toBeInTheDocument()
    expect(
      within(navigation).getByRole('link', { name: 'Overview' })
    ).toHaveAttribute('href', '/dashboard')
  })
  it.each([
    [false, '/sign-up'],
    [true, '/dashboard'],
  ])(
    'centers the one-click desktop open beside the auth-aware primary action (authenticated=%s)',
    async (isAuthenticated, primaryHref) => {
      if (isAuthenticated) {
        useAuthStore.getState().auth.setBundle(createTestAuthBundle())
      }
      const { container } = await renderApp(
        <CiLandingPage
          isAuthenticated={isAuthenticated}
          models={models}
          maxSavingsPercent={0}
        />,
        client
      )
      const hero = container.querySelector<HTMLElement>('.ci-hero')
      if (!hero) throw new Error('Missing hero')
      const actions = hero.querySelector('.ci-heroActions--primary')
      expect(actions).not.toBeNull()
      expect(
        within(hero).getByRole('link', {
          name: 'Open YesChoy desktop in one click',
        })
      ).toHaveAttribute('href', '/desktop/connect')
      expect(
        within(hero).getByRole('link', { name: 'Start saving' })
      ).toHaveAttribute('href', primaryHref)
      expect(
        within(hero).getByRole('link', { name: 'Client' })
      ).toHaveAttribute('href', '/client')
      expect(
        within(hero).getByText(
          'Already installed? One tap opens the app and signs you into this site—no long URL.'
        )
      ).toBeVisible()
    }
  )

  it.each([
    [false, '/sign-up'],
    [true, '/dashboard'],
  ])(
    'jumps from the hero hackathon badge to the Qupper’s Forge spotlight with an external event link (authenticated=%s)',
    async (isAuthenticated, primaryHref) => {
      if (isAuthenticated) {
        useAuthStore.getState().auth.setBundle(createTestAuthBundle())
      }
      const { container } = await renderApp(
        <CiLandingPage
          isAuthenticated={isAuthenticated}
          models={models}
          maxSavingsPercent={0}
        />,
        client
      )
      const hero = container.querySelector<HTMLElement>('.ci-hero')
      if (!hero) throw new Error('Missing hero')

      const badge = within(hero).getByRole('link', { name: /Qupper's Forge/ })
      const spotlight = screen.getByRole('region', {
        name: 'BUILD FOR REAL. SHIP FOR MARKET.',
      })
      expect(badge).toHaveAttribute('href', `#${spotlight.id}`)
      expect(spotlight.previousElementSibling).toBe(hero)

      const eventLink = within(spotlight).getByRole('link', {
        name: /Explore the hackathon/,
      })
      expect(eventLink).toHaveAttribute(
        'href',
        'https://qupper.fastrun.com.cn/'
      )
      expect(eventLink).toHaveAttribute('target', '_blank')
      expect(eventLink).toHaveAttribute('rel', 'noopener noreferrer')
      expect(
        within(spotlight).getByRole('link', { name: 'Start building' })
      ).toHaveAttribute('href', primaryHref)
    }
  )

  it('lists only the host and us, with our gradient mark second', async () => {
    await renderApp(
      <CiLandingPage
        isAuthenticated={false}
        models={models}
        maxSavingsPercent={0}
      />,
      client
    )
    const partners = screen.getByRole('list', { name: 'Event partners' })
    const items = within(partners).getAllByRole('listitem')

    expect(items).toHaveLength(2)
    expect(
      within(items[0]).getByRole('img', { name: 'Fastrun Cloud' })
    ).toBeVisible()
    expect(items[0]).toHaveTextContent('Event host')
    // Our own card: the all-green mark beside the stacked 野菜 / YesChoy
    // wordmark.
    expect(within(items[1]).getByText(PRODUCT_NAME)).toBeVisible()
    expect(within(items[1]).getByText(PRODUCT_NAME_LATIN)).toBeVisible()
    expect(items[1]).toHaveTextContent('Model supply partner')
    expect(items[1].querySelector('img')).toHaveAttribute(
      'src',
      '/yeschoy-mark-green.svg'
    )
  })

  describe('hero hackathon badge click', () => {
    beforeEach(() => {
      window.history.replaceState(null, '', window.location.pathname)
    })
    afterEach(() => {
      vi.restoreAllMocks()
      Reflect.deleteProperty(document, 'startViewTransition')
    })

    async function renderBadge() {
      const { container } = await renderApp(
        <CiLandingPage
          isAuthenticated={false}
          models={models}
          maxSavingsPercent={0}
        />,
        client
      )
      const hero = container.querySelector<HTMLElement>('.ci-hero')
      const panel = container.querySelector<HTMLElement>('.ci-forgePanel')
      if (!hero || !panel) throw new Error('Missing hero or spotlight panel')
      const badge = within(hero).getByRole('link', { name: /Qupper's Forge/ })
      return { badge, panel }
    }

    it('keeps the anchor jump and lights up the spotlight when motion is reduced', async () => {
      const startViewTransition = vi.fn()
      Object.defineProperty(document, 'startViewTransition', {
        configurable: true,
        value: startViewTransition,
      })
      const { badge, panel } = await renderBadge()

      await userEvent.click(badge)

      expect(startViewTransition).not.toHaveBeenCalled()
      expect(window.location.hash).toBe('#hackathon')
      expect(panel).toHaveClass('is-landed')
    })

    it('morphs the badge into the spotlight panel when view transitions are available', async () => {
      let morphTarget = ''
      Object.defineProperty(document, 'startViewTransition', {
        configurable: true,
        value: (update: () => void) => {
          update()
          morphTarget = panel.style.getPropertyValue('view-transition-name')
          return { finished: Promise.resolve() }
        },
      })
      const { badge, panel } = await renderBadge()
      vi.spyOn(window, 'matchMedia').mockImplementation(
        (query: string) => ({ matches: false, media: query }) as MediaQueryList
      )

      await userEvent.click(badge)

      expect(morphTarget).toBe('forge-spotlight')
      expect(window.location.hash).toBe('#hackathon')
      expect(badge.style.getPropertyValue('view-transition-name')).toBe('')
      await waitFor(() => expect(panel).toHaveClass('is-landed'))
      expect(panel.style.getPropertyValue('view-transition-name')).toBe('')
    })
  })

  it('uses the savings translation instead of the on/off control translation', async () => {
    const discounted = buildModelCatalog(
      [{ ...models[0].pricingModel, group_ratio: { default: 0.5 } }],
      1
    )
    await renderApp(
      <CiLandingPage
        isAuthenticated={false}
        models={discounted}
        maxSavingsPercent={50}
      />,
      client
    )
    expect(screen.getAllByText('Save 50%').length).toBeGreaterThan(0)
  })
  it.each([
    ['qwen-max', 'Qwen', 'Qwen.Color', null],
    ['kimi-k2', 'Moonshot', 'Moonshot', null],
    ['private-model', 'Acme', undefined, 'A'],
  ])(
    'uses the matching or neutral hero icon for %s',
    async (modelName, vendorName, vendorIcon, fallbackText) => {
      const catalog = buildModelCatalog(
        [
          {
            ...models[0].pricingModel,
            model_name: modelName,
            vendor_name: vendorName,
            vendor_icon: vendorIcon,
            group_ratio: { default: 0.5 },
          },
        ],
        1
      )
      const { container } = await renderApp(
        <CiLandingPage
          isAuthenticated={false}
          models={catalog}
          maxSavingsPercent={50}
        />,
        client
      )
      const logo = container.querySelector('.ci-heroModelLogo')

      expect(logo).not.toBeNull()
      expect(logo?.querySelector('img')).toBeNull()
      if (fallbackText) {
        expect(logo).toHaveTextContent(fallbackText)
      } else {
        await waitFor(() => expect(logo?.querySelector('svg')).not.toBeNull())
      }
    }
  )
  it('closes mobile navigation when an in-page destination is selected', async () => {
    const user = userEvent.setup()
    await renderApp(
      <CiLandingPage
        isAuthenticated={false}
        models={models}
        maxSavingsPercent={0}
      />,
      client
    )
    const trigger = screen.getByRole('button', { name: 'Open navigation' })
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const navigation = screen.getByRole('navigation', {
      name: 'Main navigation',
    })
    expect(
      within(navigation).getByRole('link', { name: 'Sign in' })
    ).toHaveAttribute('href', '/sign-in')
    expect(
      within(navigation).getByRole('link', { name: 'Start saving' })
    ).toHaveAttribute('href', '/sign-up')
    expect(
      screen.queryByRole('button', { name: 'Profile' })
    ).not.toBeInTheDocument()
    expect(
      within(navigation).queryByRole('link', { name: 'Model Price' })
    ).not.toBeInTheDocument()
    expect(
      within(navigation).queryByRole('link', { name: 'Docs' })
    ).not.toBeInTheDocument()
    expect(
      within(navigation).getByRole('link', { name: 'Client' })
    ).toHaveAttribute('href', '/client')
    await user.click(screen.getByRole('link', { name: 'Models' }))
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })
  it('keeps table-cell layout and makes the loaded live comparison visible', async () => {
    style.textContent = readFileSync('src/styles/ci-landing.css', 'utf8')
    const { container } = await renderApp(
      <CiLandingPage
        isAuthenticated={false}
        models={models}
        maxSavingsPercent={0}
      />,
      client
    )
    const cells = [...container.querySelectorAll('tbody td')]
    expect(cells.length).toBeGreaterThan(0)
    expect(
      cells.every((cell) => getComputedStyle(cell).display === 'table-cell')
    ).toBe(true)
    const comparison = container.querySelector('.ci-rateComparison')
    if (!comparison) throw new Error('Missing live comparison')
    expect(getComputedStyle(comparison).opacity).toBe('1')
  })
})

describe('configured landing footer', () => {
  it.each([true, false])(
    'renders custom notices and respects enabled legal links=%s',
    async (enabled) => {
      useSystemConfigStore.getState().setConfig({
        footerHtml:
          '<strong>Operator registration notice</strong><script>window.footerInjected = true</script>',
      })
      client.setQueryData(
        ['status'],
        {
          user_agreement_enabled: enabled,
          privacy_policy_enabled: enabled,
        },
        { updatedAt: Date.now() + 60000 }
      )
      await renderApp(
        <CiLandingPage
          isAuthenticated={false}
          models={models}
          maxSavingsPercent={0}
        />,
        client
      )
      const footer = screen.getByRole('contentinfo')
      expect(
        within(footer).getByText('Operator registration notice')
      ).toBeVisible()
      expect(footer.querySelector('script')).toBeNull()
      for (const [name, href] of [
        ['User Agreement', '/user-agreement'],
        ['Privacy Policy', '/privacy-policy'],
      ]) {
        if (enabled) {
          expect(within(footer).getByRole('link', { name })).toHaveAttribute(
            'href',
            href
          )
        } else {
          expect(within(footer).queryByRole('link', { name })).toBeNull()
        }
      }
      expect(
        within(footer).getByRole('link', { name: 'New API' })
      ).toHaveAttribute('href', 'https://github.com/QuantumNous/new-api')
    }
  )
})
