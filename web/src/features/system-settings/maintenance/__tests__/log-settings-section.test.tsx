import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

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

vi.mock('../../hooks/use-update-option', () => ({
  useUpdateOption: () => ({ mutateAsync: vi.fn() }),
}))

const defaults = {
  LogConsumeEnabled: true,
  CacheRateStatsEnabled: true,
  CacheRateUserVisibleEnabled: true,
}

// The section renders exactly three switch fields, in schema order.
function getSwitches(): HTMLElement[] {
  const switches = screen.getAllByRole('switch')
  expect(switches).toHaveLength(3)
  return switches
}

describe('LogSettingsSection defaultValues reset', () => {
  it('keeps unsaved switch edits when the parent re-renders with a new defaultValues object holding the same values', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <LogSettingsSection defaultValues={defaults} />
    )

    const consumeSwitch = getSwitches()[0]
    expect(consumeSwitch).toHaveAttribute('aria-checked', 'true')

    await user.click(consumeSwitch)
    expect(consumeSwitch).toHaveAttribute('aria-checked', 'false')

    // The parent (section-registry) rebuilds the settings object on every
    // render, so the prop identity changes while the values do not. A reset
    // keyed on the object identity would discard the unsaved toggle above.
    rerender(
      <LogSettingsSection
        defaultValues={{
          LogConsumeEnabled: true,
          CacheRateStatsEnabled: true,
          CacheRateUserVisibleEnabled: true,
        }}
      />
    )

    expect(getSwitches()[0]).toHaveAttribute('aria-checked', 'false')
  })

  it('resets the form to the new server values when the defaults actually change', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <LogSettingsSection defaultValues={defaults} />
    )

    const consumeSwitch = getSwitches()[0]
    await user.click(consumeSwitch)
    expect(consumeSwitch).toHaveAttribute('aria-checked', 'false')

    rerender(
      <LogSettingsSection
        defaultValues={{
          LogConsumeEnabled: false,
          CacheRateStatsEnabled: true,
          CacheRateUserVisibleEnabled: true,
        }}
      />
    )

    expect(getSwitches()[0]).toHaveAttribute('aria-checked', 'false')
    expect(getSwitches()[1]).toHaveAttribute('aria-checked', 'true')
  })
})
