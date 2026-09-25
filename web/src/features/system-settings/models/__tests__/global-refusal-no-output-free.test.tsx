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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { GlobalSettingsCard } from '../global-settings-card'

const mocks = vi.hoisted(() => ({
  updateSystemOption: vi.fn(),
}))

vi.mock('../../api', () => ({
  updateSystemOption: mocks.updateSystemOption,
}))

const defaultValues = {
  global: {
    pass_through_request_enabled: false,
    refusal_no_output_free: false,
    thinking_model_blacklist: '[]',
    chat_completions_to_responses_policy: '{}',
  },
  general_setting: {
    ping_interval_enabled: false,
    ping_interval_seconds: 60,
  },
}

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <GlobalSettingsCard defaultValues={defaultValues} />
    </QueryClientProvider>
  )
  return { ...utils, queryClient }
}

describe('global refusal_no_output_free setting', () => {
  beforeEach(() => {
    mocks.updateSystemOption.mockReset()
    mocks.updateSystemOption.mockResolvedValue({ success: true, message: '' })
  })

  test('renders the switch off when the stored option is false', () => {
    const { queryClient } = renderCard()

    const toggle = screen.getByRole('switch', {
      name: 'Do not bill refusals without output',
    })

    expect(toggle).toHaveAttribute('aria-checked', 'false')
    queryClient.clear()
  })

  test('turning the switch on and saving updates only the refusal option', async () => {
    const { container, queryClient } = renderCard()
    const toggle = screen.getByRole('switch', {
      name: 'Do not bill refusals without output',
    })

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    const form = container.querySelector('form')
    expect(form).not.toBeNull()
    fireEvent.submit(form as HTMLFormElement)

    await waitFor(() => {
      expect(mocks.updateSystemOption).toHaveBeenCalledTimes(1)
    })
    expect(mocks.updateSystemOption).toHaveBeenCalledWith({
      key: 'global.refusal_no_output_free',
      value: true,
    })
    queryClient.clear()
  })
})
