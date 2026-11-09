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
// This is an active-content wrapper, NOT a general-purpose HTML sanitizer.
// Its only consumer is an opaque-origin iframe with sandbox="allow-scripts".
export const IQ_PREVIEW_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; worker-src 'none'"
export const IQ_PREVIEW_SANDBOX = 'allow-scripts'

const forbidden =
  'base,meta,iframe,frame,frameset,object,embed,form,link,applet,portal'
const urlAttributes = new Set([
  'src',
  'href',
  'xlink:href',
  'srcset',
  'action',
  'formaction',
  'poster',
  'background',
  'data',
  'ping',
  'srcdoc',
  'manifest',
  'codebase',
])

function normalize(fragment: DocumentFragment): void {
  fragment.querySelectorAll(forbidden).forEach((node) => node.remove())
  fragment.querySelectorAll('*').forEach((node) => {
    if (node instanceof HTMLTemplateElement) normalize(node.content)
    if (
      node.localName === 'script' &&
      (node.hasAttribute('src') ||
        node.hasAttribute('href') ||
        node.hasAttribute('xlink:href'))
    ) {
      node.remove()
      return
    }
    // Snapshot names before mutation; NamedNodeMap is live.
    for (const name of node.getAttributeNames()) {
      if (!urlAttributes.has(name.toLowerCase())) continue
      const value = (node.getAttribute(name) ?? '').trim()
      // Static navigation is unnecessary for artwork. Keep self-contained image
      // data and local SVG references; CSP remains the boundary for active JS/CSS.
      const localReference = value.startsWith('#')
      const imageData = node.localName === 'img' || node.localName === 'image'
      if (
        !localReference &&
        !(imageData && /^(data:image\/|blob:)/i.test(value))
      ) {
        node.removeAttribute(name)
      }
    }
  })
}

// Template parsing is inert: no scripts run and no image/frame loads occur in
// the host. Never append the parsed nodes to the application document.
export function buildIQPreviewDocument(artifact: string): string {
  if (new TextEncoder().encode(artifact).length > 1024 * 1024) {
    throw new Error('IQ artifact is too large')
  }
  const template = document.createElement('template')
  template.innerHTML = artifact
  normalize(template.content)

  // HTML template parsing ignores document-level tags. Preserve common scene
  // styling/language attributes using inert parsing, never raw interpolation.
  function sceneAttributes(tag: 'html' | 'body'): string {
    const attributes = artifact.match(
      new RegExp(`<${tag}\\b([^>]*)>`, 'i')
    )?.[1]
    if (!attributes) return ''
    const holder = document.createElement('template')
    holder.innerHTML = `<div ${attributes}></div>`
    const element = holder.content.firstElementChild
    if (!element) return ''
    const safe = document.createElement('div')
    for (const name of ['class', 'id', 'style', 'lang', 'dir']) {
      if (element.hasAttribute(name)) {
        safe.setAttribute(name, element.getAttribute(name) ?? '')
      }
    }
    return safe.outerHTML.slice(4, -7)
  }

  // The trusted policy precedes ALL model-controlled attributes and markup.
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${IQ_PREVIEW_CSP}"><meta name="referrer" content="no-referrer"><style>html,body{margin:0;min-height:100%;}svg{max-width:100%;}</style></head><body${sceneAttributes('body')}><div${sceneAttributes('html')}>${template.innerHTML}</div></body></html>`
}
