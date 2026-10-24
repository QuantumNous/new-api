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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { lazy, Suspense, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Dialog } from '@/components/dialog'
import { LobeIconField } from '@/components/lobe-icon-field'

import { Combobox } from '../combobox'
import { Sheet, SheetContent, SheetTitle } from '../sheet'

const options = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Google' },
  { value: 'disabled', label: 'Unavailable provider', disabled: true },
]

function Fixture() {
  const [value, setValue] = useState('openai')
  return (
    <>
      <Combobox
        options={options}
        value={value}
        onValueChange={(next) => setValue(next ?? '')}
        aria-label='Provider'
        emptyText='No matching provider'
      />
      <output>{value}</output>
    </>
  )
}

describe('searchable single selection', () => {
  it.each(['dialog', 'sheet'] as const)(
    'keeps the options closed when a %s autofocuses the input, then opens on click',
    async (container) => {
      const field = <Fixture />
      render(
        container === 'dialog' ? (
          <Dialog open title='Choose a provider'>
            {field}
          </Dialog>
        ) : (
          <Sheet open>
            <SheetContent>
              <SheetTitle>Choose a provider</SheetTitle>
              {field}
            </SheetContent>
          </Sheet>
        )
      )
      const user = userEvent.setup()
      const input = screen.getByRole('combobox', { name: 'Provider' })
      await waitFor(() => expect(input).toHaveFocus())
      expect(input).toHaveAttribute('aria-expanded', 'false')
      expect(input).toHaveValue('OpenAI')
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

      await user.click(input)
      expect(screen.getByRole('option', { name: 'Google' })).toBeVisible()
      await user.click(screen.getByRole('option', { name: 'Google' }))
      await waitFor(() => expect(input).toHaveValue('Google'))
      expect(input).toHaveAttribute('aria-expanded', 'false')
      expect(screen.getByRole('dialog')).toBeVisible()
    }
  )

  it('keeps options closed on Tab focus and opens them with the arrow key', async () => {
    render(<Fixture />)
    const user = userEvent.setup()
    const input = screen.getByRole('combobox', { name: 'Provider' })
    await user.tab()
    expect(input).toHaveFocus()
    expect(input).toHaveAttribute('aria-expanded', 'false')
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: 'Google' })).toBeVisible()
    await user.keyboard('{Escape}')
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(input).toHaveValue('OpenAI')
  })

  it('opens and filters when typing into a focused, closed input', async () => {
    render(<Fixture />)
    const user = userEvent.setup()
    const input = screen.getByRole('combobox', { name: 'Provider' })
    await user.tab()
    await user.keyboard('g')
    expect(input).toHaveValue('g')
    expect(screen.getByRole('option', { name: 'Google' })).toBeVisible()
    expect(
      screen.queryByRole('option', { name: 'OpenAI' })
    ).not.toBeInTheDocument()
  })

  it.each([true, false])(
    'honors explicit openOnFocus=%s',
    async (openOnFocus) => {
      render(
        <Combobox
          options={options}
          value='openai'
          aria-label='Provider'
          openOnFocus={openOnFocus}
        />
      )
      const user = userEvent.setup()
      const input = screen.getByRole('combobox', { name: 'Provider' })
      await user.tab()
      expect(input).toHaveFocus()
      expect(input).toHaveAttribute('aria-expanded', String(openOnFocus))
      if (!openOnFocus) {
        await user.click(screen.getByRole('button', { name: 'Provider' }))
        expect(screen.getByRole('option', { name: 'Google' })).toBeVisible()
      }
    }
  )

  it('searches labels and values without committing text, shows empty results, and restores the selection on Escape', async () => {
    render(<Fixture />)
    const user = userEvent.setup()
    const input = screen.getByRole('combobox', { name: 'Provider' })
    expect(input).toHaveValue('OpenAI')
    await user.click(input)
    await user.type(input, 'missing')
    expect(screen.getByText('No matching provider')).toBeVisible()
    expect(screen.getByText('openai')).toHaveTextContent('openai')
    await user.keyboard('{Escape}')
    expect(input).toHaveValue('OpenAI')
    await user.click(input)
    await user.type(input, 'gemini')
    expect(screen.getByRole('option', { name: 'Google' })).toBeVisible()
    await user.keyboard('{ArrowDown}{Enter}')
    await waitFor(() => expect(input).toHaveValue('Google'))
    expect(screen.getByText('gemini')).toHaveTextContent('gemini')
  })

  it('respects disabled controls and options', async () => {
    const change = vi.fn()
    const view = render(
      <Combobox
        options={options}
        value='openai'
        onValueChange={change}
        aria-label='Provider'
        disabled
      />
    )
    const user = userEvent.setup()
    expect(screen.getByRole('combobox', { name: 'Provider' })).toBeDisabled()
    view.rerender(
      <Combobox
        options={options}
        value='openai'
        onValueChange={change}
        aria-label='Provider'
      />
    )
    await user.click(screen.getByRole('combobox', { name: 'Provider' }))
    expect(
      screen.getByRole('option', { name: 'Unavailable provider' })
    ).toHaveAttribute('aria-disabled', 'true')
    await user.click(
      screen.getByRole('option', { name: 'Unavailable provider' })
    )
    expect(change).not.toHaveBeenCalled()
  })
})

const pluginOptions = [
  {
    value: 'alpha',
    label: 'Alpha plugin',
    icon: <img src='/api/plugin/task/alpha/icon' alt='' />,
  },
  {
    value: 'beta',
    label: 'Beta plugin',
    icon: <img src='/api/plugin/task/beta/icon' alt='' />,
  },
]

function PluginSelectionFixture() {
  const [value, setValue] = useState<string | null>('alpha')
  return (
    <Combobox
      options={pluginOptions}
      value={value}
      onValueChange={setValue}
      showSelectedIcon
      aria-label='Task plugin'
    />
  )
}

describe('selected option icons', () => {
  it('shows the selected plugin logo and updates it when choosing another plugin', async () => {
    render(<PluginSelectionFixture />)
    const user = userEvent.setup()
    const input = screen.getByRole('combobox', { name: 'Task plugin' })
    expect(screen.getByAltText('')).toHaveAttribute(
      'src',
      '/api/plugin/task/alpha/icon'
    )
    await user.click(input)
    const nextOption = screen.getByRole('option', { name: 'Beta plugin' })
    expect(nextOption.querySelector('img')).toHaveAttribute(
      'src',
      '/api/plugin/task/beta/icon'
    )
    await user.click(nextOption)
    await waitFor(() => expect(input).toHaveValue('Beta plugin'))
    expect(screen.getByAltText('')).toHaveAttribute(
      'src',
      '/api/plugin/task/beta/icon'
    )
  })

  it('removes the logo when the selection is cleared or no longer has an icon', () => {
    const view = render(
      <Combobox
        options={pluginOptions}
        value='alpha'
        showSelectedIcon
        aria-label='Task plugin'
      />
    )
    expect(screen.getByAltText('')).toBeInTheDocument()
    view.rerender(
      <Combobox
        options={pluginOptions}
        value={null}
        showSelectedIcon
        aria-label='Task plugin'
      />
    )
    expect(screen.queryByAltText('')).not.toBeInTheDocument()
    view.rerender(
      <Combobox
        options={[{ value: 'alpha', label: 'Alpha plugin' }]}
        value='alpha'
        showSelectedIcon
        aria-label='Task plugin'
      />
    )
    expect(screen.queryByAltText('')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Task plugin' })).toHaveValue(
      'Alpha plugin'
    )
  })

  it('preserves the existing text-only selected state unless icon display is requested', () => {
    render(
      <Combobox
        options={pluginOptions}
        value='alpha'
        aria-label='Task plugin'
      />
    )
    expect(screen.queryByAltText('')).not.toBeInTheDocument()
  })
})

function VirtualIconFixture(props: {
  loadIcon: (name: string) => void
  virtualized?: boolean
}) {
  const [value, setValue] = useState('')
  const [icons] = useState(() =>
    Array.from({ length: 160 }, (_, index) => {
      const name = `Icon${String(index).padStart(3, '0')}`
      const Icon = lazy(async () => {
        props.loadIcon(name)
        return { default: () => <svg aria-label={name} /> }
      })
      return {
        value: name,
        label: name,
        icon: (
          <Suspense fallback={null}>
            <Icon />
          </Suspense>
        ),
      }
    })
  )
  return (
    <Combobox
      options={icons}
      value={value}
      onValueChange={(next) => setValue(next ?? '')}
      allowCustomValue
      virtualized={props.virtualized ?? true}
      aria-label='Icon'
    />
  )
}

describe('virtualized custom selection', () => {
  const scrollToDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'scrollTo'
  )

  beforeEach(() => {
    // Supply browser layout and scrolling; keep the real virtualizer and lazy icons.
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(
      function (this: HTMLElement) {
        return this.getAttribute('role') === 'listbox' ? 200 : 32
      }
    )
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(320)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(200)
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
      function (this: HTMLElement) {
        return [...this.children].reduce((height, child) => {
          if (
            !(child instanceof HTMLElement) ||
            child.style.position === 'absolute'
          ) {
            return height
          }
          return height + (Number.parseFloat(child.style.height) || 32)
        }, 0)
      }
    )
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value(this: HTMLElement, options: ScrollToOptions) {
        const top = Math.max(
          0,
          Math.min(options.top ?? 0, this.scrollHeight - this.clientHeight)
        )
        if (this.scrollTop === top) return
        this.scrollTop = top
        this.dispatchEvent(new Event('scroll'))
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (scrollToDescriptor) {
      Object.defineProperty(
        HTMLElement.prototype,
        'scrollTo',
        scrollToDescriptor
      )
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo')
    }
  })

  it('loads only visible icons on opening and loads new icons on scrolling', async () => {
    const loadIcon = vi.fn()
    render(<VirtualIconFixture loadIcon={loadIcon} />)
    const user = userEvent.setup()
    expect(loadIcon).not.toHaveBeenCalled()
    await user.click(screen.getByRole('combobox', { name: 'Icon' }))
    expect(screen.getAllByRole('option').length).toBeLessThan(20)
    expect(loadIcon.mock.calls.length).toBeGreaterThan(0)
    expect(loadIcon.mock.calls.length).toBeLessThan(20)
    expect(loadIcon).not.toHaveBeenCalledWith('Icon080')

    const list = screen.getByRole('listbox')
    fireEvent.scroll(list, { target: { scrollTop: 2560 } })
    await waitFor(() => expect(loadIcon).toHaveBeenCalledWith('Icon080'))
    expect(
      screen.queryByRole('option', { name: 'Icon000' })
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole('option').length).toBeLessThan(20)
    const loaded = loadIcon.mock.calls.length
    fireEvent.scroll(list, { target: { scrollTop: 0 } })
    await screen.findByRole('option', { name: 'Icon000' })
    expect(loadIcon).toHaveBeenCalledTimes(loaded)
  })

  it('filters the full catalog after scrolling and loads only the matching search result', async () => {
    const loadIcon = vi.fn()
    render(<VirtualIconFixture loadIcon={loadIcon} />)
    const user = userEvent.setup()
    const input = screen.getByRole('combobox', { name: 'Icon' })
    await user.click(input)
    fireEvent.scroll(screen.getByRole('listbox'), {
      target: { scrollTop: 2560 },
    })
    await screen.findByRole('option', { name: 'Icon080' })
    loadIcon.mockClear()
    fireEvent.change(input, { target: { value: 'Icon150' } })
    const match = await screen.findByRole('option', { name: 'Icon150' })
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(loadIcon.mock.calls).toEqual([['Icon150']])
    expect(screen.getByRole('listbox').scrollTop).toBe(0)
    await user.click(match)
    expect(input).toHaveValue('Icon150')
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  it('navigates to offscreen options with the keyboard and keeps the active option mounted', async () => {
    render(<VirtualIconFixture loadIcon={vi.fn()} />)
    const user = userEvent.setup()
    const input = screen.getByRole('combobox', { name: 'Icon' })
    await user.click(input)
    await user.keyboard('{ArrowUp}')
    const last = await screen.findByRole('option', { name: 'Icon159' })
    expect(input).toHaveAttribute('aria-activedescendant', last.id)
    expect(last).toHaveAttribute('aria-posinset', '160')
    expect(last).toHaveAttribute('aria-setsize', '160')
    expect(screen.getByRole('listbox').scrollTop).toBeGreaterThan(0)
    fireEvent.scroll(screen.getByRole('listbox'), { target: { scrollTop: 0 } })
    expect(last).toBeInTheDocument()
    await user.keyboard('{Enter}')
    expect(input).toHaveValue('Icon159')
    expect(input).toHaveAttribute('aria-expanded', 'false')
    await user.keyboard('{ArrowDown}')
    await screen.findByRole('option', { name: 'Icon000' })
    expect(input).not.toHaveAttribute('aria-activedescendant')
    await user.keyboard('{ArrowDown}{Enter}')
    expect(input).toHaveValue('Icon000')
  })

  it('keeps custom input usable when no options match', async () => {
    render(<VirtualIconFixture loadIcon={vi.fn()} />)
    const user = userEvent.setup()
    const input = screen.getByRole('combobox', { name: 'Icon' })
    await user.click(input)
    fireEvent.change(input, { target: { value: 'Custom.Avatar' } })
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
    expect(input).not.toHaveAttribute('aria-activedescendant')
    await user.keyboard('{Enter}')
    expect(input).toHaveValue('Custom.Avatar')
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  it('keeps existing custom selectors unvirtualized when the option is disabled', async () => {
    render(<VirtualIconFixture loadIcon={vi.fn()} virtualized={false} />)
    await userEvent
      .setup()
      .click(screen.getByRole('combobox', { name: 'Icon' }))
    expect(screen.getAllByRole('option')).toHaveLength(160)
  })

  it('enables virtualization in the actual model and vendor icon field', async () => {
    render(
      <>
        <label htmlFor='lobe-icon'>Icon</label>
        <LobeIconField id='lobe-icon' value='' onChange={vi.fn()} />
      </>
    )
    await userEvent
      .setup()
      .click(screen.getByRole('combobox', { name: 'Icon' }))
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('option').length).toBeLessThan(20)
  })
})
