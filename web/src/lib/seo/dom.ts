export function upsertMetaByName(name: string, content: string) {
  if (typeof document === 'undefined' || !content) return
  let el = document.querySelector(
    `meta[name="${CSS.escape(name)}"]`
  ) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export function upsertMetaByProperty(property: string, content: string) {
  if (typeof document === 'undefined' || !content) return
  let el = document.querySelector(
    `meta[property="${CSS.escape(property)}"]`
  ) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('property', property)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export function upsertLinkRel(rel: string, href: string) {
  if (typeof document === 'undefined' || !href) return
  let el = document.querySelector(
    `link[rel="${CSS.escape(rel)}"]`
  ) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export function upsertJsonLd(id: string, data: unknown) {
  if (typeof document === 'undefined' || data == null) return
  let el = document.getElementById(id) as HTMLScriptElement | null
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = id
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

export function removeJsonLd(id: string) {
  if (typeof document === 'undefined') return
  document.getElementById(id)?.remove()
}
