import { useEffect } from 'react'

export interface SeoOptions {
  title?: string
  description?: string
  /** JSON-LD structured data (Organization, WebSite, SoftwareApplication, ...) */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
}

function setMeta(key: string, content: string, attr: 'name' | 'property' = 'name') {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/**
 * Lightweight client-side SEO for the SPA marketing site.
 * Updates document.title + meta description/og tags and injects JSON-LD.
 * (No SSR available; crawlers that execute JS — e.g. Google — will index these.)
 */
export function useSeo({ title, description, jsonLd }: SeoOptions) {
  const jsonLdKey = JSON.stringify(jsonLd ?? {})
  useEffect(() => {
    if (title) document.title = title
    if (description) {
      setMeta('description', description)
      setMeta('og:description', description, 'property')
      setMeta('og:title', title ?? document.title, 'property')
    }
    let script: HTMLScriptElement | null = null
    if (jsonLd) {
      script = document.createElement('script')
      script.type = 'application/ld+json'
      script.textContent = JSON.stringify(jsonLd)
      document.head.appendChild(script)
    }
    return () => {
      if (script) script.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, jsonLdKey])
}
