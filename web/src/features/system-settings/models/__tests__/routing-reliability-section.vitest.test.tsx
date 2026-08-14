import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { updateSystemOption } from '../../api'
import { SettingsPageProvider } from '../../components/settings-page-context'
import { RoutingReliabilitySection } from '../routing-reliability-section'

vi.mock('../../api', () => ({
  updateSystemOption: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const defaultValues = {
  RetryTimes: 1,
  ChannelDisableThreshold: '',
  AutomaticDisableChannelEnabled: false,
  AutomaticEnableChannelEnabled: false,
  AutomaticDisableKeywords: '',
  AutomaticDisableStatusCodes: '401',
  AutomaticRetryStatusCodes: '500',
  EmptyResponseRetryEnabled: true,
  ResponseBlacklistKeywords: 'upstream error\r\nempty response',
  'monitor_setting.auto_test_channel_enabled': false,
  'monitor_setting.auto_test_channel_minutes': 10,
  'monitor_setting.channel_test_concurrency': 32,
  'monitor_setting.channel_test_mode': 'scheduled_all' as const,
}

let actionsContainer: HTMLDivElement | null = null

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  actionsContainer = document.createElement('div')
  document.body.append(actionsContainer)

  const view = render(
    <QueryClientProvider client={queryClient}>
      <SettingsPageProvider actionsContainer={actionsContainer}>
        <RoutingReliabilitySection defaultValues={defaultValues} />
      </SettingsPageProvider>
    </QueryClientProvider>
  )

  return { queryClient, ...view }
}

describe('RoutingReliabilitySection response validation settings', () => {
  afterEach(() => {
    cleanup()
    actionsContainer?.remove()
    actionsContainer = null
    vi.mocked(updateSystemOption).mockReset()
  })

  test('loads existing option values and normalizes multiline keywords', () => {
    renderSection()

    expect(
      screen.getByRole('switch', { name: 'Retry empty responses' })
    ).toBeChecked()
    expect(screen.getByLabelText('Response blacklist keywords')).toHaveValue(
      'upstream error\nempty response'
    )
  })

  test('submits only the changed response validation switch', async () => {
    const user = userEvent.setup()
    vi.mocked(updateSystemOption).mockResolvedValue({
      success: true,
      message: '',
    })
    renderSection()

    await user.click(
      screen.getByRole('switch', { name: 'Retry empty responses' })
    )
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => expect(updateSystemOption).toHaveBeenCalledTimes(1))
    expect(updateSystemOption).toHaveBeenCalledWith({
      key: 'EmptyResponseRetryEnabled',
      value: false,
    })
  })

  test('normalizes multiline keywords before submitting the changed value', async () => {
    const user = userEvent.setup()
    vi.mocked(updateSystemOption).mockResolvedValue({
      success: true,
      message: '',
    })
    renderSection()

    const keywords = screen.getByLabelText('Response blacklist keywords')
    await user.clear(keywords)
    fireEvent.change(keywords, {
      target: { value: 'rate limit\r\nempty response' },
    })
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => expect(updateSystemOption).toHaveBeenCalledTimes(1))
    expect(updateSystemOption).toHaveBeenCalledWith({
      key: 'ResponseBlacklistKeywords',
      value: 'rate limit\nempty response',
    })
  })
})
