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
  LogRecordClientInfoEnabled: false,
  LogClientInfoUserVisibleEnabled: false,
}

const CONSUME_LABEL = 'Record quota usage'
const RECORD_LABEL = 'Record caller IP and client identifier'
const VISIBLE_LABEL = 'Allow users to view their own IP and client identifier'

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

function submitForm(switchElement: HTMLElement) {
  const form = switchElement.closest('form')
  expect(form).not.toBeNull()
  fireEvent.submit(form as HTMLFormElement)
}

describe('LogSettingsSection client info switches', () => {
  beforeEach(() => {
    mocks.mutateAsync.mockReset()
  })

  it('renders the two client-info switches with the server defaults', () => {
    render(<LogSettingsSection defaultValues={defaults} />)

    expect(screen.getAllByRole('switch')).toHaveLength(3)
    expect(getSwitch(CONSUME_LABEL)).toHaveAttribute('aria-checked', 'true')
    expect(getSwitch(RECORD_LABEL)).toHaveAttribute('aria-checked', 'false')
    expect(getSwitch(VISIBLE_LABEL)).toHaveAttribute('aria-checked', 'false')
  })

  it('keeps unsaved switch edits when the parent re-renders with a new defaultValues object holding the same values', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<LogSettingsSection defaultValues={defaults} />)

    const recordSwitch = getSwitch(RECORD_LABEL)
    await user.click(recordSwitch)
    expect(recordSwitch).toHaveAttribute('aria-checked', 'true')

    // The parent (section-registry) rebuilds the settings object on every
    // render, so the prop identity changes while the values do not. A reset
    // keyed on the object identity would discard the unsaved toggle above.
    rerender(
      <LogSettingsSection
        defaultValues={{
          LogConsumeEnabled: true,
          LogRecordClientInfoEnabled: false,
          LogClientInfoUserVisibleEnabled: false,
        }}
      />
    )

    expect(getSwitch(RECORD_LABEL)).toHaveAttribute('aria-checked', 'true')
  })

  it('resets the form to the new server values when the defaults actually change', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<LogSettingsSection defaultValues={defaults} />)

    const recordSwitch = getSwitch(RECORD_LABEL)
    await user.click(recordSwitch)
    expect(recordSwitch).toHaveAttribute('aria-checked', 'true')

    // New server values that differ from both the original defaults and the
    // unsaved edit: the reset must overwrite the edit with the new values.
    rerender(
      <LogSettingsSection
        defaultValues={{
          LogConsumeEnabled: true,
          LogRecordClientInfoEnabled: false,
          LogClientInfoUserVisibleEnabled: true,
        }}
      />
    )

    expect(getSwitch(RECORD_LABEL)).toHaveAttribute('aria-checked', 'false')
    expect(getSwitch(VISIBLE_LABEL)).toHaveAttribute('aria-checked', 'true')
  })

  it('sends only the changed option and nothing else on save', async () => {
    const user = userEvent.setup()
    render(<LogSettingsSection defaultValues={defaults} />)

    const recordSwitch = getSwitch(RECORD_LABEL)
    await user.click(recordSwitch) // LogRecordClientInfoEnabled: false -> true
    submitForm(recordSwitch)

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1)
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      key: 'LogRecordClientInfoEnabled',
      value: true,
    })
  })

  it('sends every changed option while skipping unchanged ones', async () => {
    const user = userEvent.setup()
    render(<LogSettingsSection defaultValues={defaults} />)

    await user.click(getSwitch(RECORD_LABEL)) // false -> true
    await user.click(getSwitch(VISIBLE_LABEL)) // false -> true
    submitForm(getSwitch(RECORD_LABEL))

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(2))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(2)
    expect(mocks.mutateAsync).toHaveBeenNthCalledWith(1, {
      key: 'LogRecordClientInfoEnabled',
      value: true,
    })
    expect(mocks.mutateAsync).toHaveBeenNthCalledWith(2, {
      key: 'LogClientInfoUserVisibleEnabled',
      value: true,
    })
  })

  it('sends a reversal saved before the refreshed defaults arrive', async () => {
    const user = userEvent.setup()
    render(<LogSettingsSection defaultValues={defaults} />)

    const recordSwitch = getSwitch(RECORD_LABEL)

    // Save the first toggle, then flip it back before the query refresh
    // delivers new defaultValues (still the pre-save object here).
    await user.click(recordSwitch) // false -> true
    submitForm(recordSwitch)
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1))

    await user.click(recordSwitch) // true -> false
    submitForm(recordSwitch)

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenLastCalledWith({
        key: 'LogRecordClientInfoEnabled',
        value: false,
      })
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(2)
  })
})
