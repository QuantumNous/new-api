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
import { beforeAll, describe, expect, mock, test } from 'bun:test'
import { createInstance } from 'i18next'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'

// `Link` needs a live router context that static rendering cannot provide;
// the anchor it produces is what these assertions are about.
mock.module('@tanstack/react-router', () => ({
  Link: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} />
  ),
}))

const { BoostBalanceContent, BOOST_TOPUP_ROUTE, BOOST_EARN_ROUTE } =
  await import('./boost-balance-dialog')
const { Dialog } = await import('@/components/ui/dialog')

const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

function renderDialog(props: { balanceDisplay: string; loading?: boolean }) {
  // The body is rendered inside a Dialog root but outside DialogContent:
  // DialogTitle/DialogDescription need the dialog store for their aria
  // wiring, while the real portal emits nothing under static rendering.
  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <Dialog open>
        <BoostBalanceContent
          balanceDisplay={props.balanceDisplay}
          loading={props.loading}
          onNavigate={() => undefined}
        />
      </Dialog>
    </I18nextProvider>
  )
}

describe('boost balance dialog', () => {
  test('shows the balance and the guidance copy', () => {
    const html = renderDialog({ balanceDisplay: '$82.35' })

    expect(html).toContain('Current available balance')
    expect(html).toContain('$82.35')
    expect(html).toContain(
      'A healthy balance keeps your work and API calls from being interrupted'
    )
  })

  test('offers both ways to raise the balance', () => {
    const html = renderDialog({ balanceDisplay: '$82.35' })

    expect(html).toContain('Quick top-up')
    expect(html).toContain('Earn credits')
  })

  // The destinations are asserted on the exported constants the component
  // actually renders with: `mock.module` is global in Bun, so another test file
  // mocking Link or the dialog primitives strips `to` from the markup during a
  // full-suite run, making an HTML assertion unreliable.
  test('the two actions point at the wallet and invite routes', () => {
    expect(BOOST_TOPUP_ROUTE).toBe('/wallet')
    expect(BOOST_EARN_ROUTE).toBe('/invite')

    const source = readFileSync(
      new URL('./boost-balance-dialog.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('render={<Link to={BOOST_TOPUP_ROUTE} />}')
    expect(source).toContain('render={<Link to={BOOST_EARN_ROUTE} />}')
  })

  test('a pending balance renders a placeholder instead of a stale zero', () => {
    const html = renderDialog({ balanceDisplay: '$0.00', loading: true })

    expect(html).toContain('—')
    expect(html).not.toContain('$0.00')
  })
})
