import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeAll, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { recallCampaignKeys } from '../api'
import { CampaignGroupSelector } from './campaign-group-selector'

const testI18n = createInstance()
const userGroupsKey = ['recall-campaigns', 'audience-options', 'user-groups']

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

function renderSelector(options?: {
  groups?: string[]
  groupMode?: '' | 'allow' | 'block'
  immutable?: boolean
  configuredGroups?: string[]
  queryState?: 'success' | 'loading' | 'error'
  omitData?: boolean
}): string {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        enabled: false,
        retry: false,
        retryOnMount: false,
        refetchOnMount: false,
      },
    },
  })
  const queryState = options?.queryState ?? 'success'

  if (queryState === 'success') {
    client.setQueryData(userGroupsKey, {
      success: true,
      data: options?.omitData ? undefined : (options?.configuredGroups ?? []),
    })
  } else {
    const query = client.getQueryCache().build(client, {
      queryKey: userGroupsKey,
      queryFn: async () => ({ success: true, data: [] }),
    })
    if (queryState === 'loading') {
      query.setState({
        ...query.state,
        status: 'pending',
        fetchStatus: 'fetching',
      })
    } else {
      query.setState({
        ...query.state,
        status: 'error',
        fetchStatus: 'idle',
        error: new Error('group request failed'),
        errorUpdatedAt: Date.now(),
        errorUpdateCount: 1,
      })
    }
  }

  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={testI18n}>
        <CampaignGroupSelector
          groups={options?.groups ?? []}
          groupMode={options?.groupMode ?? 'allow'}
          onChange={() => undefined}
          immutable={options?.immutable ?? false}
        />
      </I18nextProvider>
    </QueryClientProvider>
  )
}

function expectRecallGroupsDisabled(html: string): void {
  expect(html).toMatch(
    /<input(?=[^>]*id="recall-groups")(?=[^>]*disabled="")[^>]*>/
  )
}

describe('CampaignGroupSelector', () => {
  test('uses the recall user-group query key', () => {
    expect(recallCampaignKeys.userGroups).toEqual(userGroupsKey)
  })

  test('renders configured options and unavailable saved fallback chips', () => {
    const html = renderSelector({
      groups: ['admin', 'removed'],
      configuredGroups: ['admin', 'plg'],
    })

    expect(html).toContain('Recall user groups')
    expect(html).toContain('admin')
    expect(html).toContain('removed')
  })

  test('disables the recall-groups input when there is no group filter', () => {
    const html = renderSelector({
      groupMode: '',
      configuredGroups: ['admin'],
    })

    expectRecallGroupsDisabled(html)
  })

  test('disables the recall-groups input for immutable campaigns', () => {
    const html = renderSelector({
      immutable: true,
      configuredGroups: ['admin'],
    })

    expectRecallGroupsDisabled(html)
  })

  test('shows distinct localized loading and error messages', () => {
    const loadingHtml = renderSelector({ queryState: 'loading' })
    const errorHtml = renderSelector({ queryState: 'error' })

    expect(loadingHtml).toContain('Loading configured user groups...')
    expectRecallGroupsDisabled(loadingHtml)
    expect(errorHtml).toContain('Failed to load configured user groups.')
    expectRecallGroupsDisabled(errorHtml)
  })

  test('disables an authoritative empty group list with localized guidance', () => {
    const html = renderSelector({ configuredGroups: [] })

    expect(html).toContain('No configured user groups are available.')
    expectRecallGroupsDisabled(html)
  })

  test('treats missing authoritative data as empty while preserving saved chips', () => {
    const html = renderSelector({
      groups: ['removed'],
      omitData: true,
    })

    expect(html).toContain('No configured user groups are available.')
    expect(html).toContain('removed')
    expectRecallGroupsDisabled(html)
  })
})
