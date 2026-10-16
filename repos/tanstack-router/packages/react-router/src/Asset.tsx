'use client'

import * as React from 'react'
import { isServer } from '@tanstack/router-core/isServer'
import { useRouter } from './useRouter'
import { useHydrated } from './ClientOnly'
import type { RouterManagedTag } from '@tanstack/router-core'

const INLINE_CSS_HYDRATION_ATTR = 'data-tsr-inline-css'

interface ScriptAttrs {
  [key: string]: string | boolean | undefined
  src?: string
  suppressHydrationWarning?: boolean
}

const noopScriptHandler = () => {}

function setScriptAttrs(
  script: HTMLScriptElement,
  attrs: ScriptAttrs | undefined,
) {
  if (!attrs) {
    return
  }

  for (const [key, value] of Object.entries(attrs)) {
    if (
      key !== 'suppressHydrationWarning' &&
      value !== undefined &&
      value !== false
    ) {
      script.setAttribute(key, typeof value === 'boolean' ? '' : String(value))
    }
  }
}

export function Asset(
  asset: RouterManagedTag & {
    nonce?: string
    preventScriptHoist?: boolean
  },
): React.ReactElement | null {
  const { attrs, children, nonce, preventScriptHoist } = asset

  switch (asset.tag) {
    case 'title':
      return (
        <title {...attrs} suppressHydrationWarning>
          {children}
        </title>
      )
    case 'meta':
      return <meta {...attrs} suppressHydrationWarning />
    case 'link':
      return (
        <link
          {...attrs}
          precedence={
            attrs?.precedence ??
            (attrs?.rel === 'stylesheet' ? 'default' : undefined)
          }
          nonce={nonce}
          suppressHydrationWarning
        />
      )
    case 'style':
      if (
        asset.inlineCss &&
        (process.env.TSS_INLINE_CSS_ENABLED === 'true' ||
          (process.env.TSS_INLINE_CSS_ENABLED === undefined && isServer))
      ) {
        return (
          <InlineCssStyle attrs={attrs} nonce={nonce}>
            {children}
          </InlineCssStyle>
        )
      }

      return (
        <style
          {...attrs}
          dangerouslySetInnerHTML={{ __html: children as string }}
          nonce={nonce}
        />
      )
    case 'script':
      return (
        <Script attrs={attrs} preventScriptHoist={preventScriptHoist}>
          {children}
        </Script>
      )
    default:
      return null
  }
}

function InlineCssStyle({
  attrs,
  children,
  nonce,
}: {
  attrs?: Record<string, any>
  children?: RouterManagedTag['children']
  nonce?: string
}) {
  const isInlineCssPlaceholder = children === undefined
  const [hydratedInlineCss] = React.useState(() => {
    if (!isInlineCssPlaceholder || typeof document === 'undefined') {
      return undefined
    }

    return (
      document.querySelector<HTMLStyleElement>(
        `style[${INLINE_CSS_HYDRATION_ATTR}]`,
      )?.textContent ?? undefined
    )
  })
  const html = isInlineCssPlaceholder
    ? (hydratedInlineCss ?? '')
    : (children ?? '')

  return (
    <style
      {...attrs}
      {...{ [INLINE_CSS_HYDRATION_ATTR]: '' }}
      dangerouslySetInnerHTML={{ __html: html }}
      nonce={nonce}
      suppressHydrationWarning
    />
  )
}

function Script({
  attrs,
  children,
  preventScriptHoist,
}: {
  attrs?: ScriptAttrs
  children?: string
  preventScriptHoist?: boolean
}) {
  const router = useRouter()
  const hydrated = useHydrated()
  const dataScript =
    typeof attrs?.type === 'string' &&
    attrs.type !== '' &&
    attrs.type !== 'text/javascript' &&
    attrs.type !== 'module'

  if (
    process.env.NODE_ENV !== 'production' &&
    attrs?.src &&
    typeof children === 'string' &&
    children.trim().length
  ) {
    console.warn(
      '[TanStack Router] <Script> received both `src` and `children`. The `children` content will be ignored. Remove `children` or remove `src`.',
    )
  }

  React.useEffect(() => {
    if (dataScript) return

    if (attrs?.src) {
      const normSrc = (() => {
        try {
          const base = document.baseURI || window.location.href
          return new URL(attrs.src, base).href
        } catch {
          return attrs.src
        }
      })()
      for (const el of document.querySelectorAll('script[src]')) {
        if ((el as HTMLScriptElement).src === normSrc) {
          return
        }
      }

      const script = document.createElement('script')

      setScriptAttrs(script, attrs)

      document.head.appendChild(script)

      return () => script.remove()
    }

    if (typeof children === 'string') {
      const typeAttr =
        typeof attrs?.type === 'string' ? attrs.type : 'text/javascript'
      const nonceAttr =
        typeof attrs?.nonce === 'string' ? attrs.nonce : undefined
      for (const el of document.querySelectorAll('script:not([src])')) {
        if (!(el instanceof HTMLScriptElement)) {
          continue
        }

        const sType = el.getAttribute('type') ?? 'text/javascript'
        const sNonce = el.getAttribute('nonce') ?? undefined
        if (
          el.textContent === children &&
          sType === typeAttr &&
          sNonce === nonceAttr
        ) {
          return
        }
      }

      const script = document.createElement('script')
      script.textContent = children
      setScriptAttrs(script, attrs)

      document.head.appendChild(script)

      return () => script.remove()
    }

    return undefined
  }, [attrs, children, dataScript])

  // --- Server rendering ---
  if (isServer ?? router.isServer) {
    if (attrs?.src) {
      if (!preventScriptHoist) {
        return <script {...attrs} suppressHydrationWarning />
      }

      return (
        <script
          {...attrs}
          // React hoists async src scripts into <head> during SSR unless they
          // have an event handler. Start's client entry must stay after router
          // dehydration.
          onLoad={noopScriptHandler}
          suppressHydrationWarning
        />
      )
    }

    if (typeof children === 'string') {
      return (
        <script
          {...attrs}
          dangerouslySetInnerHTML={{ __html: children }}
          suppressHydrationWarning
        />
      )
    }

    return null
  }

  // --- Client rendering ---

  // Data scripts (e.g. application/ld+json) are rendered in the tree;
  // the useEffect intentionally skips them.
  if (dataScript && typeof children === 'string') {
    return (
      <script
        {...attrs}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: children }}
      />
    )
  }

  // During hydration (before useEffect has fired), render the script element
  // to match the server-rendered HTML and avoid structural hydration mismatches.
  // After hydration, return null — the useEffect handles imperative injection.
  if (!hydrated) {
    if (attrs?.src) {
      return <script {...attrs} suppressHydrationWarning />
    }

    if (typeof children === 'string') {
      return (
        <script
          {...attrs}
          dangerouslySetInnerHTML={{ __html: children }}
          suppressHydrationWarning
        />
      )
    }
  }

  return null
}
