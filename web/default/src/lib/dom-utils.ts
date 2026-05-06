function upsertLinkTag(
  selector: string,
  create: () => HTMLLinkElement,
  href: string
) {
  if (typeof document === 'undefined' || !href) return
  try {
    const next = new URL(href, window.location.href).href
    const existing = document.querySelector<HTMLLinkElement>(selector)
    if (existing && existing.href === next) return
    const link = existing ?? create()
    link.href = href
    if (!existing) {
      document.head.appendChild(link)
    }
  } catch {
    // Ignore malformed URLs
  }
}

export function applyMetaTagToDom(name: string, content: string) {
  if (typeof document === 'undefined' || !content) return
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', name)
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', content)
}

export function applyDocumentTitle(title: string) {
  if (typeof document === 'undefined' || !title) return
  document.title = title
  applyMetaTagToDom('title', title)
}

export function applyFaviconToDom(url: string) {
  upsertLinkTag(
    'link[rel~="icon"]',
    () => {
      const link = document.createElement('link')
      link.rel = 'icon'
      return link
    },
    url
  )
}

export function applyAppleTouchIconToDom(url: string) {
  upsertLinkTag(
    'link[rel="apple-touch-icon"]',
    () => {
      const link = document.createElement('link')
      link.rel = 'apple-touch-icon'
      return link
    },
    url
  )
}

export function applyManifestToDom(url: string) {
  upsertLinkTag(
    'link[rel="manifest"]',
    () => {
      const link = document.createElement('link')
      link.rel = 'manifest'
      return link
    },
    url
  )
}

export function applyThemeColorToDom(color: string) {
  applyMetaTagToDom('theme-color', color)
}
