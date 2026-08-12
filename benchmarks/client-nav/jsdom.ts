import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
})

const { window } = dom

function setGlobal(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
  })
}

setGlobal('window', window)
setGlobal('document', window.document)
setGlobal('self', window)
setGlobal('navigator', window.navigator)
setGlobal('location', window.location)
setGlobal('history', window.history)
setGlobal('HTMLElement', window.HTMLElement)
setGlobal('Element', window.Element)
setGlobal('SVGElement', window.SVGElement)
setGlobal('DocumentFragment', window.DocumentFragment)
setGlobal('Node', window.Node)
setGlobal('MouseEvent', window.MouseEvent)
setGlobal('MutationObserver', window.MutationObserver)
setGlobal('sessionStorage', window.sessionStorage)
setGlobal('localStorage', window.localStorage)
setGlobal('getComputedStyle', window.getComputedStyle.bind(window))

setGlobal(
  'requestAnimationFrame',
  window.requestAnimationFrame?.bind(window) ??
    ((callback: (time: number) => void) =>
      setTimeout(() => callback(performance.now()), 16)),
)

setGlobal(
  'cancelAnimationFrame',
  window.cancelAnimationFrame?.bind(window) ??
    ((handle: number) => clearTimeout(handle)),
)

window.scrollTo = () => {}

export { window }
