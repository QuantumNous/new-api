import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MonitoringSettingsSection } from '../monitoring-settings-section'

const mocks = vi.hoisted(() => ({ mutateAsync: vi.fn() }))

vi.mock('../../hooks/use-update-option', () => ({
  useUpdateOption: () => ({ mutateAsync: mocks.mutateAsync }),
}))

const defaults = {
  QuotaRemindThreshold: '1000',
  'perf_metrics_setting.enabled': true,
  'perf_metrics_setting.flush_interval': 5,
  'perf_metrics_setting.bucket_time': 'hour' as const,
  'perf_metrics_setting.retention_days': 0,
  CacheRateStatsEnabled: true,
  CacheRateUserVisibleEnabled: true,
}

// Switch order matches the DOM: perf metrics enabled, cache rate stats,
// cache rate user visibility. Inputs and selects are not switches.
function getSwitches(): HTMLElement[] {
  const switches = screen.getAllByRole('switch')
  expect(switches).toHaveLength(3)
  return switches
}

function getCacheSwitches(): [HTMLElement, HTMLElement] {
  const switches = getSwitches()
  return [switches[1], switches[2]]
}

describe('MonitoringSettingsSection form behavior', () => {
  beforeEach(() => {
    mocks.mutateAsync.mockReset()
  })

  it('keeps unsaved switch edits when the parent re-renders with a new defaultValues object holding the same values', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <MonitoringSettingsSection defaultValues={defaults} />
    )

    const [statsSwitch] = getCacheSwitches()
    expect(statsSwitch).toHaveAttribute('aria-checked', 'true')

    await user.click(statsSwitch)
    expect(statsSwitch).toHaveAttribute('aria-checked', 'false')

    // The parent registry rebuilds the settings object on every render; a
    // reset keyed on the object identity would discard the unsaved toggle.
    rerender(<MonitoringSettingsSection defaultValues={{ ...defaults }} />)

    expect(getCacheSwitches()[0]).toHaveAttribute('aria-checked', 'false')
  })

  it('resets the form to the new server values when the defaults actually change', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <MonitoringSettingsSection defaultValues={defaults} />
    )

    const [statsSwitch] = getCacheSwitches()
    await user.click(statsSwitch)
    expect(statsSwitch).toHaveAttribute('aria-checked', 'false')

    rerender(
      <MonitoringSettingsSection
        defaultValues={{ ...defaults, CacheRateStatsEnabled: false }}
      />
    )

    expect(getCacheSwitches()[0]).toHaveAttribute('aria-checked', 'false')
    expect(getCacheSwitches()[1]).toHaveAttribute('aria-checked', 'true')
  })

  it('disables the user-visibility switch while the cache stats switch is off', async () => {
    const user = userEvent.setup()
    render(<MonitoringSettingsSection defaultValues={defaults} />)

    const [statsSwitch, userVisibleSwitch] = getCacheSwitches()
    // Base UI switches expose the disabled state via aria-disabled.
    expect(userVisibleSwitch.getAttribute('aria-disabled')).not.toBe('true')

    await user.click(statsSwitch) // stats off -> user visibility disabled
    expect(statsSwitch).toHaveAttribute('aria-checked', 'false')
    expect(userVisibleSwitch).toHaveAttribute('aria-disabled', 'true')
  })

  it('sends one option update per changed field and stops after a failed save', async () => {
    const user = userEvent.setup()
    render(<MonitoringSettingsSection defaultValues={defaults} />)

    // Toggle the user-visibility switch first: once the stats switch is off
    // the user-visibility switch is disabled and can no longer be toggled.
    const [statsSwitch, userVisibleSwitch] = getCacheSwitches()
    await user.click(userVisibleSwitch) // CacheRateUserVisibleEnabled: true -> false
    await user.click(statsSwitch) // CacheRateStatsEnabled: true -> false

    const form = statsSwitch.closest('form')
    expect(form).not.toBeNull()

    // First update fails: the loop must stop, so the second option is not sent.
    mocks.mutateAsync.mockRejectedValueOnce(new Error('update failed'))
    fireEvent.submit(form as HTMLFormElement)

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1))
    // Let the submit chain settle before the final count, so a loop that
    // wrongly continues after the rejection is caught.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1)
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      key: 'CacheRateStatsEnabled',
      value: false,
    })
  })

  it('sends every changed field when all saves succeed', async () => {
    const user = userEvent.setup()
    render(<MonitoringSettingsSection defaultValues={defaults} />)

    const [statsSwitch, userVisibleSwitch] = getCacheSwitches()
    // Toggle the user-visibility switch first (see the test above).
    await user.click(userVisibleSwitch) // CacheRateUserVisibleEnabled: true -> false
    await user.click(statsSwitch) // CacheRateStatsEnabled: true -> false

    const form = statsSwitch.closest('form')
    fireEvent.submit(form as HTMLFormElement)

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(2))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(mocks.mutateAsync).toHaveBeenNthCalledWith(1, {
      key: 'CacheRateStatsEnabled',
      value: false,
    })
    expect(mocks.mutateAsync).toHaveBeenNthCalledWith(2, {
      key: 'CacheRateUserVisibleEnabled',
      value: false,
    })
  })

  it('sends a reversal saved before the refreshed defaults arrive', async () => {
    const user = userEvent.setup()
    render(<MonitoringSettingsSection defaultValues={defaults} />)

    const [statsSwitch] = getCacheSwitches()
    const form = statsSwitch.closest('form') as HTMLFormElement

    // Save the first toggle, then flip it back before the query refresh
    // delivers new defaultValues (still the pre-save object here).
    await user.click(statsSwitch) // CacheRateStatsEnabled: true -> false
    fireEvent.submit(form)
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1))

    await user.click(statsSwitch) // CacheRateStatsEnabled: false -> true
    fireEvent.submit(form)

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenLastCalledWith({
        key: 'CacheRateStatsEnabled',
        value: true,
      })
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(2)
  })
})
