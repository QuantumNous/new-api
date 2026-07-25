import * as React from 'react'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import * as comboboxUi from '@/components/ui/combobox'

type ComboboxRootProps = {
  children: React.ReactNode
  inputValue: string
  items: string[]
  itemToStringLabel?: (itemValue: string) => string
  onInputValueChange: (value: string) => void
  onValueChange: (value: string[]) => void
  value: string[]
}

let latestComboboxProps: ComboboxRootProps | undefined
let latestInputChange: ((value: string) => void) | undefined
let selectOption: ((value: string) => void) | undefined

spyOn(comboboxUi, 'Combobox').mockImplementation(((
  props: ComboboxRootProps
) => {
  latestComboboxProps = props
  return <div>{props.children}</div>
}) as never)
spyOn(comboboxUi, 'ComboboxChip').mockImplementation((({
  children,
}: {
  children: React.ReactNode
}) => <span>{children}</span>) as never)
spyOn(comboboxUi, 'ComboboxChips').mockImplementation((({
  children,
}: {
  children: React.ReactNode
}) => <div>{children}</div>) as never)
spyOn(comboboxUi, 'ComboboxChipsInput').mockImplementation(((props: {
  disabled?: boolean
  id?: string
}) => {
  latestInputChange = (value: string) =>
    latestComboboxProps?.onInputValueChange(value)
  return <input id={props.id} disabled={props.disabled} />
}) as never)
spyOn(comboboxUi, 'ComboboxCollection').mockImplementation((({
  children,
}: {
  children: (value: string) => React.ReactNode
}) => <>{latestComboboxProps?.items.map(children)}</>) as never)
spyOn(comboboxUi, 'ComboboxContent').mockImplementation((({
  children,
}: {
  children: React.ReactNode
}) => <div>{children}</div>) as never)
spyOn(comboboxUi, 'ComboboxEmpty').mockImplementation((({
  children,
}: {
  children: React.ReactNode
}) => <div>{children}</div>) as never)
spyOn(comboboxUi, 'ComboboxItem').mockImplementation((({
  children,
  value,
}: {
  children: React.ReactNode
  value: string
}) => {
  selectOption = (nextValue: string) =>
    latestComboboxProps?.onValueChange([
      ...(latestComboboxProps.value ?? []),
      nextValue,
    ])
  return <button value={value}>{children}</button>
}) as never)
spyOn(comboboxUi, 'ComboboxList').mockImplementation((({
  children,
}: {
  children: React.ReactNode
}) => <div>{children}</div>) as never)
spyOn(comboboxUi, 'ComboboxValue').mockImplementation((({
  children,
}: {
  children: (value: string[]) => React.ReactNode
}) => <>{children(latestComboboxProps?.value ?? [])}</>) as never)
spyOn(comboboxUi, 'useComboboxAnchor').mockImplementation((() =>
  React.createRef<HTMLDivElement>()) as never)

const { MultiSelect } = await import('./multi-select')
const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

beforeEach(() => {
  latestComboboxProps = undefined
  latestInputChange = undefined
  selectOption = undefined
})

afterAll(() => {
  for (const exportedValue of Object.values(comboboxUi)) {
    if (
      typeof exportedValue === 'function' &&
      'mockRestore' in exportedValue &&
      typeof exportedValue.mockRestore === 'function'
    ) {
      exportedValue.mockRestore()
    }
  }
})

function renderMultiSelect(props: React.ComponentProps<typeof MultiSelect>) {
  renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <MultiSelect {...props} />
    </I18nextProvider>
  )
}

describe('MultiSelect search notifications', () => {
  test('notifies when the combobox input value changes', () => {
    const searches: string[] = []
    renderMultiSelect({
      options: [{ label: 'Ada Lovelace', value: '1' }],
      selected: [],
      onChange: () => undefined,
      onSearchChange: (value) => searches.push(value),
      placeholder: 'Search users',
    })

    latestInputChange?.('ada')

    expect(searches).toEqual(['ada'])
  })

  test('notifies with an empty search after selecting an option', () => {
    const searches: string[] = []
    const selected: string[][] = []
    renderMultiSelect({
      options: [{ label: 'Ada Lovelace', value: '1' }],
      selected: [],
      onChange: (values) => selected.push(values),
      onSearchChange: (value) => searches.push(value),
      placeholder: 'Search users',
    })

    latestInputChange?.('ada')
    selectOption?.('1')

    expect(selected).toEqual([['1']])
    expect(searches.at(-1)).toBe('')
  })
})

describe('MultiSelect option filtering labels', () => {
  test('provides option labels to Base UI filtering for numeric values', () => {
    renderMultiSelect({
      options: [
        {
          label: 'Ada Lovelace - ada@example.com - #1',
          value: '1',
        },
      ],
      selected: [],
      onChange: () => undefined,
      placeholder: 'Search users',
    })

    expect(latestComboboxProps?.itemToStringLabel?.('1')).toBe(
      'Ada Lovelace - ada@example.com - #1'
    )
  })
})
