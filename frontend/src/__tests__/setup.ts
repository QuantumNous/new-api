import { afterEach, vi } from 'vitest'
import { config } from '@vue/test-utils'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }),
})

vi.stubGlobal('ResizeObserver', ResizeObserverStub)
Element.prototype.scrollIntoView = vi.fn()
HTMLElement.prototype.scrollTo = vi.fn()
window.scrollTo = vi.fn()
Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
  configurable: true,
  get() {
    return this.parentElement
  },
})

afterEach(() => {
  document.body.innerHTML = ''
  window.localStorage.clear()
})

config.global.stubs = {
  transition: false,
  'transition-group': false,
}
