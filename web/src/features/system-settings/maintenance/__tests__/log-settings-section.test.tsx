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

const defaults = {
  LogConsumeEnabled: true,
  'log_setting.user_export_enabled': true,
  'log_setting.max_range_days': 30,
}

const CONSUME_LABEL = 'Record quota usage'
const EXPORT_LABEL = 'Allow users to export logs'

// Switches carry no accessible name; locate one by the label rendered in its
// own switch item. The item is the largest ancestor containing exactly one
// switch, so the label lookup can never leak into a sibling item or the form.
function switchItemContainer(sw: HTMLElement, all: HTMLElement[]): HTMLElement {
  let node: HTMLElement | null = sw.parentElement
  let item: HTMLElement = sw
  while (node && node !== document.body) {
    const current: HTMLElement = node
    if (all.some((s) => s !== sw && current.contains(s))) break
    item = current
    node = current.parentElement
  }
  return item
}

function getSwitch(label: string): HTMLElement {
  const switches = screen.getAllByRole('switch')
  const target = switches.find((sw) =>
    switchItemContainer(sw, switches).textContent?.includes(label)
  )
  if (!target) throw new Error(`No switch found for label: ${label}`)
  return target
}

function submitForm(element: HTMLElement) {
  const form = element.closest('form')
  expect(form).not.toBeNull()
  fireEvent.submit(form as HTMLFormElement)
}

describe('LogSettingsSection defaultValues reset', () => {
  beforeEach(() => {
    mocks.mutateAsync.mockReset()
  })

  it('keeps unsaved switch edits when the parent re-renders with a new defaultValues object holding the same values', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<LogSettingsSection defaultValues={defaults} />)

    const consumeSwitch = getSwitch(CONSUME_LABEL)
    expect(consumeSwitch).toHaveAttribute('aria-checked', 'true')

    await user.click(consumeSwitch)
    expect(consumeSwitch).toHaveAttribute('aria-checked', 'false')

    // The parent (section-registry) rebuilds the settings object on every
    // render, so the prop identity changes while the values do not. A reset
    // keyed on the object identity would discard the unsaved toggle above.
    rerender(<LogSettingsSection defaultValues={{ ...defaults }} />)

    expect(getSwitch(CONSUME_LABEL)).toHaveAttribute('aria-checked', 'false')
  })

  it('resets the form to the new server values when the defaults actually change', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<LogSettingsSection defaultValues={defaults} />)

    const consumeSwitch = getSwitch(CONSUME_LABEL)
    await user.click(consumeSwitch)
    expect(consumeSwitch).toHaveAttribute('aria-checked', 'false')

    // New server values that differ from both the original defaults and the
    // unsaved edit: the reset must overwrite the edit with the new values.
    rerender(
      <LogSettingsSection defaultValues={{ ...defaults, LogConsumeEnabled: false }} />
    )

    expect(getSwitch(CONSUME_LABEL)).toHaveAttribute('aria-checked', 'false')
    expect(getSwitch(EXPORT_LABEL)).toHaveAttribute('aria-checked', 'true')
  })

  it('sends the changed option and nothing else on save', async () => {
    const user = userEvent.setup()
    render(<LogSettingsSection defaultValues={defaults} />)

    const consumeSwitch = getSwitch(CONSUME_LABEL)
    await user.click(consumeSwitch) // LogConsumeEnabled: true -> false
    submitForm(consumeSwitch)

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

  it('sends every changed option while skipping unchanged ones', async () => {
    const user = userEvent.setup()
    render(<LogSettingsSection defaultValues={defaults} />)

    await user.click(getSwitch(CONSUME_LABEL)) // true -> false
    await user.click(getSwitch(EXPORT_LABEL)) // true -> false
    submitForm(getSwitch(CONSUME_LABEL))

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(2))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(mocks.mutateAsync).toHaveBeenNthCalledWith(1, {
      key: 'LogConsumeEnabled',
      value: false,
    })
    expect(mocks.mutateAsync).toHaveBeenNthCalledWith(2, {
      key: 'log_setting.user_export_enabled',
      value: false,
    })
  })

  it('keeps pending switch edits when a refresh lands between sequential saves', async () => {
    const user = userEvent.setup()
    // The first save resolves immediately; the second hangs until the test
    // releases it, so the system-options refresh can land mid-save.
    let releaseSecondSave: (() => void) | undefined
    mocks.mutateAsync
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseSecondSave = resolve
          })
      )

    const { rerender } = render(<LogSettingsSection defaultValues={defaults} />)
    await user.click(getSwitch(CONSUME_LABEL)) // true -> false
    await user.click(getSwitch(EXPORT_LABEL)) // true -> false
    submitForm(getSwitch(CONSUME_LABEL))

    // Save one persisted; the submit loop is now awaiting the second save.
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(2))
    expect(mocks.mutateAsync).toHaveBeenNthCalledWith(1, {
      key: 'LogConsumeEnabled',
      value: false,
    })

    // The refreshed defaults echo only the first saved value; the pending
    // export edit must survive this mid-save reconciliation.
    rerender(
      <LogSettingsSection
        defaultValues={{ ...defaults, LogConsumeEnabled: false }}
      />
    )
    expect(getSwitch(CONSUME_LABEL)).toHaveAttribute('aria-checked', 'false')
    expect(getSwitch(EXPORT_LABEL)).toHaveAttribute('aria-checked', 'false')

    releaseSecondSave?.()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(mocks.mutateAsync).toHaveBeenNthCalledWith(2, {
      key: 'log_setting.user_export_enabled',
      value: false,
    })
    expect(getSwitch(EXPORT_LABEL)).toHaveAttribute('aria-checked', 'false')
  })

  it('stops applying options after a failed save and keeps the failed value unsaved', async () => {
    const user = userEvent.setup()
    mocks.mutateAsync.mockRejectedValueOnce(new Error('save failed'))

    render(<LogSettingsSection defaultValues={defaults} />)
    await user.click(getSwitch(CONSUME_LABEL)) // true -> false
    await user.click(getSwitch(EXPORT_LABEL)) // true -> false
    submitForm(getSwitch(CONSUME_LABEL))

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    // The second option must not be sent after the first one failed.
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1)
  })

  it('sends a reversal saved before the refreshed defaults arrive', async () => {
    const user = userEvent.setup()
    render(<LogSettingsSection defaultValues={defaults} />)

    const consumeSwitch = getSwitch(CONSUME_LABEL)

    // Save the first toggle, then flip it back before the query refresh
    // delivers new defaultValues (still the pre-save object here).
    await user.click(consumeSwitch) // LogConsumeEnabled: true -> false
    submitForm(consumeSwitch)
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1))

    await user.click(consumeSwitch) // LogConsumeEnabled: false -> true
    submitForm(consumeSwitch)

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
