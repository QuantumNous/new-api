export default function (storageKey: string, key?: string) {
  let byKey

  try {
    byKey = JSON.parse(sessionStorage.getItem(storageKey) || '{}')
  } catch {
    return
  }

  const elementEntries = byKey?.[key || history.state?.__TSR_key]
  let windowRestored = false

  for (const elementSelector in elementEntries) {
    const entry = elementEntries[elementSelector]
    const scrollX = entry?.scrollX
    const scrollY = entry?.scrollY

    if (Number.isFinite(scrollX) && Number.isFinite(scrollY)) {
      if (elementSelector === 'window') {
        scrollTo(scrollX, scrollY)
        windowRestored = true
      } else if (elementSelector) {
        try {
          const element = document.querySelector(elementSelector)
          if (element) {
            element.scrollLeft = scrollX
            element.scrollTop = scrollY
          }
        } catch {}
      }
    }
  }

  if (windowRestored) return

  const hash = location.hash.slice(1)

  if (hash) {
    const hashScrollIntoViewOptions =
      history.state?.__hashScrollIntoViewOptions ?? true

    if (hashScrollIntoViewOptions) {
      const el = document.getElementById(hash)
      if (el) {
        el.scrollIntoView(hashScrollIntoViewOptions)
      }
    }

    return
  }

  scrollTo(0, 0)
}
