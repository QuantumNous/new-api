import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { handleDropdownMenuItemSelect } from './dropdown-menu-events'

function createMenuEvent() {
  let defaultPrevented = false
  let baseUIHandlerPrevented = false

  return {
    get defaultPrevented() {
      return defaultPrevented
    },
    preventDefault() {
      defaultPrevented = true
    },
    preventBaseUIHandler() {
      baseUIHandlerPrevented = true
    },
    get baseUIHandlerPrevented() {
      return baseUIHandlerPrevented
    },
  } as unknown as Parameters<typeof handleDropdownMenuItemSelect>[0] & {
    baseUIHandlerPrevented: boolean
  }
}

describe('DropdownMenuItem onSelect compatibility', () => {
  test('calls the Radix-style onSelect handler on item click', () => {
    const event = createMenuEvent()
    let selected = false

    handleDropdownMenuItemSelect(event, undefined, () => {
      selected = true
    })

    assert.equal(selected, true)
    assert.equal(event.baseUIHandlerPrevented, false)
  })

  test('keeps the Base UI menu open when onSelect prevents default', () => {
    const event = createMenuEvent()

    handleDropdownMenuItemSelect(event, undefined, (selectEvent) => {
      selectEvent.preventDefault()
    })

    assert.equal(event.defaultPrevented, true)
    assert.equal(event.baseUIHandlerPrevented, true)
  })
})
