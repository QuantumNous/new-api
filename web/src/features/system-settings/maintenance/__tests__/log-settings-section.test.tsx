import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LogSettingsSection } from '../log-settings-section'

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: { success: true, data: null } }),
  },
}))

vi.mock('../../api', () => ({
  getCurrentLogCleanupTask: vi
    .fn()
    .mockResolvedValue({ success: true, data: null }),
  getSystemTask: vi.fn().mockResolvedValue({ success: true, data: null }),
  startLogCleanupTask: vi.fn(),
}))

const mocks = vi.hoisted(() => ({ mutateAsync: vi.fn() }))

vi.mock('../../hooks/use-update-option', () => ({
  useUpdateOption: () => ({ mutateAsync: mocks.mutateAsync }),
}))

const defaults = { LogConsumeEnabled: true }

// The section renders exactly one switch field (the cache-rate switches
// moved to Monitoring & Alerts).
function getSwitch(): HTMLElement {
  const switches = screen.getAllByRole('switch')
  expect(switches).toHaveLength(1)
  return switches[0]
}

describe('LogSettingsSection defaultValues reset', () => {
  beforeEach(() => {
    mocks.mutateAsync.mockReset()
  })

  it('keeps unsaved switch edits when the parent re-renders with a new defaultValues object holding the same values', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <LogSettingsSection defaultValues={defaults} />
    )

    const consumeSwitch = getSwitch()
    expect(consumeSwitch).toHaveAttribute('aria-checked', 'true')

    await user.click(consumeSwitch)
    expect(consumeSwitch).toHaveAttribute('aria-checked', 'false')

    // The parent (section-registry) rebuilds the settings object on every
    // render, so the prop identity changes while the values do not. A reset
    // keyed on the object identity would discard the unsaved toggle above.
    rerender(<LogSettingsSection defaultValues={{ LogConsumeEnabled: true }} />)

    expect(getSwitch()).toHaveAttribute('aria-checked', 'false')
  })

  it('resets the form to the new server values when the defaults actually change', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <LogSettingsSection defaultValues={defaults} />
    )

    const consumeSwitch = getSwitch()
    await user.click(consumeSwitch)
    expect(consumeSwitch).toHaveAttribute('aria-checked', 'false')

    // New server values that differ from both the original defaults and the
    // unsaved edit: the reset must overwrite the edit with the new values.
    rerender(
      <LogSettingsSection defaultValues={{ LogConsumeEnabled: false }} />
    )

    expect(getSwitch()).toHaveAttribute('aria-checked', 'false')
  })

  it('sends the changed option and nothing else on save', async () => {
    const user = userEvent.setup()
    render(<LogSettingsSection defaultValues={defaults} />)

    const consumeSwitch = getSwitch()
    await user.click(consumeSwitch) // LogConsumeEnabled: true -> false

    const form = consumeSwitch.closest('form')
    expect(form).not.toBeNull()
    fireEvent.submit(form as HTMLFormElement)

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1)
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      key: 'LogConsumeEnabled',
      value: false,
    })
  })

  it('sends a reversal saved before the refreshed defaults arrive', async () => {
    const user = userEvent.setup()
    render(<LogSettingsSection defaultValues={defaults} />)

    const consumeSwitch = getSwitch()
    const form = consumeSwitch.closest('form') as HTMLFormElement

    // Save the first toggle, then flip it back before the query refresh
    // delivers new defaultValues (still the pre-save object here).
    await user.click(consumeSwitch) // LogConsumeEnabled: true -> false
    fireEvent.submit(form)
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1))

    await user.click(consumeSwitch) // LogConsumeEnabled: false -> true
    fireEvent.submit(form)

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenLastCalledWith({
        key: 'LogConsumeEnabled',
        value: true,
      })
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(2)
  })
})
