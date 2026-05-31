/**
 * Minimal HTML sanitizer to prevent XSS when rendering server-provided HTML.
 * Strips dangerous tags (script, iframe, object, embed, form) and event handlers.
 */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  // Remove dangerous tags
  const dangerous = doc.querySelectorAll('script, iframe, object, embed, form, applet, base, meta, link')
  dangerous.forEach((el) => el.remove())

  // Remove event handler attributes from all remaining elements
  const all = doc.querySelectorAll('*')
  all.forEach((el) => {
    const attrs = Array.from(el.attributes)
    for (const attr of attrs) {
      if (attr.name.startsWith('on') || attr.value.trim().toLowerCase().startsWith('javascript:')) {
        el.removeAttribute(attr.name)
      }
    }
  })

  return doc.body.innerHTML
}
