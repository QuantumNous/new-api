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
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider } from 'react-i18next'

import type { UserSubscriptionRecord } from '@/features/subscriptions/types'

import { partitionSubscriptions } from '../lib/subscriptions'
import { SubscriptionList } from './subscription-list'

const record = (
  id: number,
  start: number,
  end: number
): UserSubscriptionRecord => ({
  subscription: {
    id,
    user_id: 1,
    plan_id: 1,
    status: 'active',
    start_time: start,
    end_time: end,
    amount_total: 100,
    amount_used: 0,
  },
})

async function renderList(records: UserSubscriptionRecord[]) {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const groups = partitionSubscriptions(records, 1000)
  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <SubscriptionList
        current={groups.current}
        history={groups.history}
        renderSubscription={(item) => <div>record-{item.subscription.id}</div>}
      />
    </I18nextProvider>
  )
}

test('the first render shows current and pending records, not historical cards', async () => {
  const html = await renderList([
    record(1, 900, 1100),
    record(2, 1100, 1200),
    record(3, 800, 900),
  ])
  assert.match(html, /record-1/)
  assert.match(html, /record-2/)
  assert.doesNotMatch(html, /record-3/)
  assert.match(html, /Subscription history/)
  assert.match(html, /aria-expanded="false"/)
})

test('accounts with only history show an empty current view and a closed history entry', async () => {
  const html = await renderList([record(3, 800, 900)])
  assert.match(html, /No current subscriptions/)
  assert.match(html, /Subscription history/)
  assert.doesNotMatch(html, /record-3/)
})

test('empty accounts do not render a history entry', async () => {
  const html = await renderList([])
  assert.match(html, /No current subscriptions/)
  assert.doesNotMatch(html, /Subscription history/)
})
