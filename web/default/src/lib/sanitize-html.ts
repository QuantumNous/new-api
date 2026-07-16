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

/**
 * Lightweight HTML sanitizer for admin-configured content.
 * No external deps (workspace may not have dompurify installed).
 */

const FORBIDDEN_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'base',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'svg',
  'math',
  'template',
  'foreignobject',
  'use',
  'animate',
  'set',
  'video',
  'audio',
  'source',
  'track',
  'frame',
  'frameset',
  'applet',
  'marquee',
])

const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'poster'])

function isSafeUrl(value: string): boolean {
  const v = value.trim().toLowerCase()
  if (!v) return false
  if (v.startsWith('#')) return true
  if (v.startsWith('/') && !v.startsWith('//')) return true
  if (v.startsWith('//')) return false
  if (v.startsWith('data:') || v.startsWith('blob:') || v.startsWith('javascript:')) {
    return false
  }
  if (
    v.startsWith('https://') ||
    v.startsWith('http://') ||
    v.startsWith('mailto:')
  ) {
    return true
  }
  return false
}

function sanitizeNode(node: Node, doc: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return doc.createTextNode(node.textContent ?? '')
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null
  }

  const el = node as Element
  const tag = el.tagName.toLowerCase()
  if (FORBIDDEN_TAGS.has(tag)) {
    return null
  }

  // Only allow a conservative set of content tags (drop unknown custom tags).
  const ALLOWED_TAGS = new Set([
    'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'code', 'col', 'colgroup',
    'dd', 'del', 'details', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'ins', 'kbd', 'li',
    'mark', 'ol', 'p', 'pre', 'q', 's', 'samp', 'section', 'small', 'span',
    'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th',
    'thead', 'tr', 'u', 'ul', 'var',
  ])
  if (!ALLOWED_TAGS.has(tag)) {
    // Keep text children of unknown tags, drop the wrapper.
    const frag = doc.createDocumentFragment()
    for (const child of Array.from(el.childNodes)) {
      const c = sanitizeNode(child, doc)
      if (c) frag.appendChild(c)
    }
    return frag.childNodes.length ? frag : null
  }

  const clean = doc.createElement(tag)

  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase()
    const value = attr.value
    if (name.startsWith('on')) continue
    if (name === 'srcdoc' || name === 'srcset') continue
    if (name === 'style') continue
    if (URL_ATTRS.has(name) || name === 'href' || name === 'src') {
      if (!isSafeUrl(value)) continue
      clean.setAttribute(attr.name, value)
      if (tag === 'a' && (name === 'href' || name === 'src') && !clean.hasAttribute('rel')) {
        clean.setAttribute('rel', 'noopener noreferrer')
      }
      if (tag === 'a' && name === 'target') {
        clean.setAttribute('target', '_blank')
      }
      continue
    }
    if (
      name === 'class' ||
      name === 'id' ||
      name === 'title' ||
      name === 'alt' ||
      name === 'width' ||
      name === 'height' ||
      name === 'colspan' ||
      name === 'rowspan' ||
      name === 'scope' ||
      name === 'target' ||
      name === 'rel' ||
      name.startsWith('aria-')
    ) {
      // Drop data-* to avoid mXSS / framework side channels via admin HTML.
      clean.setAttribute(attr.name, value)
    }
  }

  for (const child of Array.from(el.childNodes)) {
    const c = sanitizeNode(child, doc)
    if (c) clean.appendChild(c)
  }
  return clean
}

/** Sanitize admin-configured HTML before dangerouslySetInnerHTML. */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return ''
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return dirty
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/<svg[\s\S]*?>[\s\S]*?<\/svg>/gi, '')
      .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/javascript\s*:/gi, '')
  }
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(
      `<div id="__root">${dirty}</div>`,
      'text/html'
    )
    const root = doc.getElementById('__root')
    if (!root) return ''
    const out = doc.createElement('div')
    for (const child of Array.from(root.childNodes)) {
      const c = sanitizeNode(child, doc)
      if (c) out.appendChild(c)
    }
    return out.innerHTML
  } catch {
    return ''
  }
}

/** Allow only http(s) iframe sources. */
export function sanitizeIframeSrc(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.protocol === 'https:' || u.protocol === 'http:') return u.toString()
  } catch {
    /* empty */
  }
  return null
}
