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
import { after, describe, test } from 'node:test'

import { Window } from 'happy-dom'

const domWindow = new Window()
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLButtonElement',
  'SVGElement',
  'Node',
  'Element',
  'Event',
  'MouseEvent',
  'CustomEvent',
  'MutationObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'getComputedStyle',
] as const

for (const key of domGlobals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: domWindow[key],
  })
}

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { AutoPricingReviewList } = await import('../auto-pricing-review-list')
const { AutoPricingStatusPanel } = await import('../auto-pricing-status-panel')
const i18n = createInstance()
await i18n.use(initReactI18next).init({ lng: 'en', resources: { en: {} } })

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

describe('automatic pricing controls', () => {
  after(() => domWindow.close())

  test('shows automatic and manual source health while sync is disabled', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <I18nextProvider i18n={i18n}>
          <AutoPricingStatusPanel
            isLoading={false}
            status={{
              enabled: true,
              fuzzy_match_enabled: true,
              remote_url: 'https://mirror.example/catalog.json',
              hash_url: 'https://mirror.example/catalog.sha256',
              check_interval_minutes: 60,
              loaded: true,
              model_count: 42,
              skipped_count: 1,
              version: 'catalog-v2',
              pending_count: 2,
              takeover_complete: true,
              revision: 'revision-v2',
              sources: [
                { source: 'override', version: 'reviewed-v1' },
                { source: 'wei-shaw', error: 'checksum mismatch' },
                { source: 'models.dev', version: 'models-v1' },
                { source: 'litellm' },
              ],
              manual_sources: [
                {
                  source: 'new-api',
                  url: 'https://basellm.github.io/preset.json',
                  manual_only: true,
                },
              ],
            }}
            isSyncing
            onSync={() => undefined}
          />
        </I18nextProvider>
      )
    })

    assert.match(container.textContent ?? '', /checksum mismatch/)
    assert.match(container.textContent ?? '', /new-api/)
    assert.match(container.textContent ?? '', /Manual only/)
    const syncButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Syncing...'
    )
    assert.ok(syncButton)
    assert.equal(syncButton.disabled, true)

    await act(async () => root.unmount())
    container.remove()
  })

  test('selects pending models and dispatches approve and reject actions', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const selections: string[][] = []
    const actions: string[] = []
    const item = {
      model: 'gpt-review',
      reason: 'price change exceeds threshold',
      fingerprint: 'fingerprint-v2',
      candidate_version: 'catalog-v2',
      current: {
        model: 'gpt-review',
        primary_source: 'wei-shaw',
        standard: { input: 2, output: 8 },
      },
      candidate: {
        model: 'gpt-review',
        primary_source: 'models.dev',
        standard: { input: 4, output: 16 },
        field_sources: { input: 'models.dev', output: 'models.dev' },
      },
    }

    const render = async (selectedModels: string[], isReviewing = false) => {
      await act(async () => {
        root.render(
          <I18nextProvider i18n={i18n}>
            <AutoPricingReviewList
              items={[item]}
              isLoading={false}
              selectedModels={selectedModels}
              onSelectionChange={(models) => selections.push(models)}
              isReviewing={isReviewing}
              onReview={(action) => actions.push(action)}
            />
          </I18nextProvider>
        )
      })
    }

    await render([])
    const checkbox = container.querySelector<HTMLElement>(
      '[aria-label="Select gpt-review"]'
    )
    assert.ok(checkbox)
    await act(async () => checkbox.click())
    assert.deepEqual(selections, [['gpt-review']])

    await render(['gpt-review'])
    const approveButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Approve selected'
    )
    const rejectButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Reject selected'
    )
    assert.ok(approveButton)
    assert.ok(rejectButton)
    assert.equal(approveButton.disabled, false)
    await act(async () => approveButton.click())
    await act(async () => rejectButton.click())
    assert.deepEqual(actions, ['approve', 'reject'])

    await render(['gpt-review'], true)
    const disabledCheckbox = container.querySelector<HTMLElement>(
      '[aria-label="Select gpt-review"]'
    )
    assert.ok(disabledCheckbox)
    await act(async () => disabledCheckbox.click())
    assert.deepEqual(selections, [['gpt-review']])
    const disabledApprove = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Approve selected'
    )
    assert.ok(disabledApprove)
    assert.equal(disabledApprove.disabled, true)

    await act(async () => root.unmount())
    container.remove()
  })
})
