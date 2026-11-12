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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { ModelRatioVisualEditor } from '../model-ratio-visual-editor'
import {
  MODEL_PRICING_ISSUES_QUERY_KEY,
  type ModelPricingIssue,
} from '../pricing-issues'

let client: QueryClient | undefined

afterEach(() => {
  client?.clear()
  localStorage.clear()
  window.getSelection()?.removeAllRanges()
  vi.restoreAllMocks()
  useAuthStore.getState().auth.reset()
})

type EditorFixture = {
  issues?: ModelPricingIssue[]
  taskModels?: string[]
  billingMode?: string
  billingExpr?: string
  pluginBillingExpr?: string
  filterMode?: 'all' | 'unset'
  candidateModelNames?: string[]
}

async function renderEditor(fixture: EditorFixture = {}) {
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/pricing') {
      const data = (fixture.taskModels ?? []).map((name) => ({
        model_name: name,
        billing_usage_schema: { seconds: { type: 'number', unit: 'second' } },
      }))
      return { data: { success: true, data, vendors: [] } }
    }
    if (url === '/api/option/model_pricing/issues') {
      return { data: { success: true, data: fixture.issues ?? [] } }
    }
    if (url === '/api/option/model_pricing') {
      return {
        data: {
          success: true,
          data: { entries: [], options: {}, empty_version: '' },
        },
      }
    }
    return { data: { success: true, data: {} } }
  })
  vi.spyOn(api, 'post').mockResolvedValue({
    data: { success: true, data: { effective: {} } },
  })
  if (fixture.issues) {
    useAuthStore
      .getState()
      .auth.setUser({ id: 1, username: 'root', role: ROLE.SUPER_ADMIN })
  }
  const modelRatio = JSON.stringify({
    'gpt-4.1-mini': 0.2,
    'claude-sonnet': 1.5,
  })
  const billingMode = fixture.billingMode ?? '{}'
  const billingExpr = fixture.billingExpr ?? '{}'
  const pluginBillingExpr = fixture.pluginBillingExpr ?? '{}'
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client = queryClient
  const view = render(
    <QueryClientProvider client={client}>
      <ModelRatioVisualEditor
        savedModelPrice='{}'
        savedModelRatio={modelRatio}
        savedCacheRatio='{}'
        savedCreateCacheRatio='{}'
        savedCompletionRatio='{}'
        savedImageRatio='{}'
        savedAudioRatio='{}'
        savedAudioCompletionRatio='{}'
        savedBillingMode={billingMode}
        savedBillingExpr={billingExpr}
        savedPluginBillingExpr={pluginBillingExpr}
        modelPrice='{}'
        modelRatio={modelRatio}
        cacheRatio='{}'
        createCacheRatio='{}'
        completionRatio='{}'
        imageRatio='{}'
        audioRatio='{}'
        audioCompletionRatio='{}'
        billingMode={billingMode}
        billingExpr={billingExpr}
        pluginBillingExpr={pluginBillingExpr}
        filterMode={fixture.filterMode}
        candidateModelNames={fixture.candidateModelNames}
        onChange={vi.fn()}
        onSave={vi.fn()}
        isSaving={false}
      />
    </QueryClientProvider>
  )
  // The real page has pricing metadata loaded long before the user drags over
  // a model name, so settle the pricing query before interacting.
  await waitFor(() => expect(queryClient.isFetching()).toBe(0))
  return { ...view, queryClient }
}

// A drag-select ends with mousedown/mouseup inside the row and the browser
// then fires `click` on the row. Only that final `click` is dispatched here so
// the text selection created by the drag is still active when the row opens
// the editor.
it('keeps the drag-selected model name highlighted when the row click opens the editor', async () => {
  await renderEditor()
  const row = await screen.findByRole('row', { name: /gpt-4\.1-mini/ })
  const nameCell = within(row).getByText('gpt-4.1-mini')
  window.getSelection()?.selectAllChildren(nameCell)
  expect(String(window.getSelection())).toBe('gpt-4.1-mini')

  fireEvent.click(nameCell)

  expect(
    await screen.findByRole('region', { name: 'Edit model pricing' })
  ).toBeInTheDocument()
  expect(nameCell).toBeInTheDocument()
  expect(String(window.getSelection())).toBe('gpt-4.1-mini')
})

it('keeps other rows mounted when a different model is opened for editing', async () => {
  await renderEditor()
  const targetRow = await screen.findByRole('row', { name: /gpt-4\.1-mini/ })
  const otherName = within(
    screen.getByRole('row', { name: /claude-sonnet/ })
  ).getByText('claude-sonnet')

  fireEvent.click(within(targetRow).getByText('gpt-4.1-mini'))

  expect(
    await screen.findByRole('region', { name: 'Edit model pricing' })
  ).toBeInTheDocument()
  expect(otherName).toBeInTheDocument()
})

// kling-v3 was never priced, issue-shared's model expression reads usage its
// new provider lacks, and vidu1.5 keeps a provider price its plugin dropped.
const pricingIssueFixture = {
  taskModels: ['issue-shared'],
  billingMode: JSON.stringify({ 'issue-shared': 'tiered_expr' }),
  billingExpr: JSON.stringify({ 'issue-shared': 'u("seconds") * 0.2' }),
  pluginBillingExpr: JSON.stringify({ 'vidu::vidu1.5': 'u("seconds") * 0.1' }),
  issues: [
    {
      model_name: 'issue-shared',
      plugin_key: 'beta',
      plugin_name: 'Beta',
      reason: 'incompatible',
    },
    {
      model_name: 'kling-v3',
      plugin_key: 'kling',
      plugin_name: 'Kling',
      reason: 'unconfigured',
    },
    {
      model_name: 'vidu1.5',
      plugin_key: 'vidu',
      plugin_name: 'Vidu',
      reason: 'stale',
    },
  ],
} satisfies EditorFixture

it.each([
  [
    'issue-shared',
    'Beta: The price uses usage the plugin no longer provides',
    'Select this plugin below and reconfigure its price using the current billing fields, then save.',
  ],
  [
    'kling-v3',
    'Kling: No price set',
    'Select this plugin below, set a price for this model, then save.',
  ],
  [
    'vidu1.5',
    'Vidu: The plugin no longer offers this model',
    'Select this plugin below, remove its saved price, then save.',
  ],
])(
  'marks %s with its pricing issue and explains the required change when opened',
  async (name, reason, action) => {
    await renderEditor(pricingIssueFixture)
    const row = await screen.findByRole('row', {
      name: new RegExp(name.replace('.', '\\.')),
    })

    expect(within(row).getByText('Price needs attention')).toBeVisible()
    expect(within(row).getByText(reason)).toBeVisible()
    expect(within(row).queryByText('Task pricing')).not.toBeInTheDocument()

    fireEvent.click(within(row).getByText(name))

    const details = await screen.findByRole('note', {
      name: 'Pricing changes needed',
    })
    expect(within(details).getByText(reason)).toBeVisible()
    expect(within(details).getByText(action)).toBeVisible()
  }
)

it('keeps the configured badges on models without pricing issues', async () => {
  await renderEditor({ ...pricingIssueFixture, issues: [] })
  const row = await screen.findByRole('row', { name: /issue-shared/ })

  expect(within(row).getByText('Task pricing')).toBeVisible()
  expect(
    within(row).queryByText('Price needs attention')
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('row', { name: /kling-v3/ })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('status', { name: 'Price needs attention' })
  ).not.toBeInTheDocument()
})

it('shows the sidebar issue count by model and filters to affected models as soon as issues load', async () => {
  await renderEditor({
    ...pricingIssueFixture,
    issues: [
      ...pricingIssueFixture.issues,
      {
        model_name: 'issue-shared',
        plugin_key: 'gamma',
        plugin_name: 'Gamma',
        reason: 'unconfigured',
      },
    ],
  })

  const summary = screen.getByRole('status', { name: 'Price needs attention' })
  expect(
    within(summary).getByText('Models needing price updates: 3')
  ).toBeVisible()
  expect(
    screen.queryByRole('row', { name: /gpt-4\.1-mini/ })
  ).not.toBeInTheDocument()
  const filter = screen.getByRole('button', { name: /Price status/ })
  expect(within(filter).getByText('Price needs attention')).toBeVisible()
  expect(screen.getByRole('row', { name: /kling-v3/ })).toBeVisible()
})

it('reviews the first affected model after clearing an unrelated search and mode filter', async () => {
  const user = userEvent.setup()
  await renderEditor(pricingIssueFixture)
  await user.click(screen.getByRole('button', { name: 'Show all models' }))
  await user.type(screen.getByPlaceholderText('Search models...'), 'gpt-4.1')
  await waitFor(() =>
    expect(
      screen.queryByRole('row', { name: /kling-v3/ })
    ).not.toBeInTheDocument()
  )
  const modeFilter = screen
    .getAllByRole('button', { name: 'Mode' })
    .find((button) => button.getAttribute('aria-haspopup') === 'dialog')
  if (!modeFilter) throw new Error('Price mode filter not found')
  await user.click(modeFilter)
  await user.click(
    await screen.findByRole('option', { name: /Per-token \(deprecated\)/ })
  )
  await user.keyboard('{Escape}')

  await user.click(screen.getByRole('button', { name: 'Review prices' }))

  expect(screen.getByPlaceholderText('Search models...')).toHaveValue('')
  expect(screen.getByRole('row', { name: /issue-shared/ })).toBeVisible()
  expect(screen.getByRole('row', { name: /kling-v3/ })).toBeVisible()
  expect(
    screen.queryByRole('row', { name: /gpt-4\.1-mini/ })
  ).not.toBeInTheDocument()
  const editor = screen.getByRole('region', { name: 'Edit model pricing' })
  expect(within(editor).getByLabelText('Model name')).toHaveValue(
    'issue-shared'
  )
  expect(
    within(editor).getByRole('note', { name: 'Pricing changes needed' })
  ).toBeVisible()
})

it('preserves the choice to show all models when issues refresh', async () => {
  const user = userEvent.setup()
  const { queryClient } = await renderEditor(pricingIssueFixture)
  await user.click(screen.getByRole('button', { name: 'Show all models' }))

  await queryClient.invalidateQueries({
    queryKey: MODEL_PRICING_ISSUES_QUERY_KEY,
  })

  expect(screen.getByRole('row', { name: /gpt-4\.1-mini/ })).toBeVisible()
  expect(screen.getByRole('row', { name: /kling-v3/ })).toBeVisible()
})

it('returns to all models when the last pricing issue is resolved', async () => {
  const fixture = { ...pricingIssueFixture }
  const { queryClient } = await renderEditor(fixture)
  fixture.issues = []

  await queryClient.invalidateQueries({
    queryKey: MODEL_PRICING_ISSUES_QUERY_KEY,
  })

  await waitFor(() =>
    expect(
      screen.queryByRole('status', { name: 'Price needs attention' })
    ).not.toBeInTheDocument()
  )
  expect(screen.getByRole('row', { name: /gpt-4\.1-mini/ })).toBeVisible()
})

it('keeps unpriced candidate models visible on the unset-prices tab', async () => {
  await renderEditor({
    ...pricingIssueFixture,
    filterMode: 'unset',
    candidateModelNames: ['kling-v3', 'unpriced-text-model'],
  })

  expect(screen.getByRole('row', { name: /kling-v3/ })).toBeVisible()
  expect(screen.getByRole('row', { name: /unpriced-text-model/ })).toBeVisible()
})

it('reviews the first affected model from page one when started from a later page', async () => {
  const user = userEvent.setup()
  const issues: ModelPricingIssue[] = Array.from(
    { length: 21 },
    (_, index) => ({
      model_name: `video-${String(index).padStart(2, '0')}`,
      plugin_key: 'video',
      plugin_name: 'Video',
      reason: 'unconfigured',
    })
  )
  await renderEditor({ issues })
  await user.click(screen.getByRole('button', { name: 'Go to next page' }))
  expect(screen.getByRole('row', { name: /video-20/ })).toBeVisible()

  await user.click(screen.getByRole('button', { name: 'Review prices' }))

  expect(screen.getByRole('row', { name: /video-00/ })).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Go to previous page' })
  ).toBeDisabled()
  const editor = screen.getByRole('region', { name: 'Edit model pricing' })
  expect(within(editor).getByLabelText('Model name')).toHaveValue('video-00')
})

it('opens the mobile pricing drawer with the same instructions through the keyboard review action', async () => {
  const user = userEvent.setup()
  const originalMatchMedia = window.matchMedia
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    ...originalMatchMedia(query),
    matches: query.includes('max-width') || originalMatchMedia(query).matches,
  }))
  await renderEditor(pricingIssueFixture)
  screen.getByRole('button', { name: 'Review prices' }).focus()

  await user.keyboard('{Enter}')

  const drawer = await screen.findByRole('dialog', {
    name: 'Edit model pricing',
  })
  const details = within(drawer).getByRole('note', {
    name: 'Pricing changes needed',
  })
  expect(
    within(details).getByText(
      'Beta: The price uses usage the plugin no longer provides'
    )
  ).toBeVisible()
  expect(
    within(details).getByText(
      'Select this plugin below and reconfigure its price using the current billing fields, then save.'
    )
  ).toBeVisible()
})

it('filters the table down to the models whose price needs attention', async () => {
  const user = userEvent.setup()
  await renderEditor(pricingIssueFixture)
  await screen.findByRole('row', { name: /kling-v3/ })
  await user.click(screen.getByRole('button', { name: 'Show all models' }))
  const filter = screen.getByRole('button', { name: /Price status/ })

  await user.click(filter)
  await user.click(
    await screen.findByRole('option', { name: /Price needs attention/ })
  )

  await waitFor(() =>
    expect(
      screen.queryByRole('row', { name: /gpt-4\.1-mini/ })
    ).not.toBeInTheDocument()
  )
  for (const name of [/issue-shared/, /kling-v3/, /vidu1\.5/]) {
    expect(screen.getByRole('row', { name })).toBeInTheDocument()
  }
  expect(
    screen.queryByRole('row', { name: /claude-sonnet/ })
  ).not.toBeInTheDocument()
  expect(within(filter).getByText('Price needs attention')).toBeInTheDocument()
})
