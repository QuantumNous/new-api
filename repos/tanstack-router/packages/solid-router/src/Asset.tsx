import { Link, Meta, Style, Title } from '@solidjs/meta'
import { onCleanup, onMount } from 'solid-js'
import { isServer } from '@tanstack/router-core/isServer'
import { useRouter } from './useRouter'
import type { RouterManagedTag } from '@tanstack/router-core'
import type { JSX } from 'solid-js'

const INLINE_CSS_HYDRATION_ATTR = 'data-tsr-inline-css'

export function Asset(asset: RouterManagedTag): JSX.Element | null {
  const { tag, attrs, children } = asset

  switch (tag) {
    case 'title':
      return <Title {...attrs}>{children}</Title>
    case 'meta':
      return <Meta {...attrs} />
    case 'link':
      return <Link {...attrs} />
    case 'style':
      if (
        asset.inlineCss &&
        (process.env.TSS_INLINE_CSS_ENABLED === 'true' ||
          (process.env.TSS_INLINE_CSS_ENABLED === undefined && isServer))
      ) {
        return <InlineCssStyle attrs={attrs}>{children}</InlineCssStyle>
      }

      return <Style {...attrs}>{children}</Style>
    case 'script':
      return <Script attrs={attrs}>{children}</Script>
    default:
      return null
  }
}

function InlineCssStyle({
  attrs,
  children,
}: {
  attrs?: Record<string, any>
  children?: RouterManagedTag['children']
}) {
  const isInlineCssPlaceholder = children === undefined
  const html = isInlineCssPlaceholder
    ? typeof document === 'undefined'
      ? ''
      : (document.querySelector<HTMLStyleElement>(
          `style[${INLINE_CSS_HYDRATION_ATTR}]`,
        )?.textContent ?? '')
    : (children ?? '')

  return (
    <Style {...attrs} {...{ [INLINE_CSS_HYDRATION_ATTR]: '' }}>
      {html}
    </Style>
  )
}

interface ScriptAttrs {
  [key: string]: string | boolean | undefined
  src?: string
}

function Script({
  attrs,
  children,
}: {
  attrs?: ScriptAttrs
  children?: string
}): JSX.Element | null {
  const router = useRouter()
  const dataScript =
    typeof attrs?.type === 'string' &&
    attrs.type !== '' &&
    attrs.type !== 'text/javascript' &&
    attrs.type !== 'module'

  onMount(() => {
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
      const existingScript = Array.from(
        document.querySelectorAll('script[src]'),
      ).find((el) => (el as HTMLScriptElement).src === normSrc)

      if (existingScript) {
        return
      }

      const script = document.createElement('script')

      for (const [key, value] of Object.entries(attrs)) {
        if (value !== undefined && value !== false) {
          script.setAttribute(
            key,
            typeof value === 'boolean' ? '' : String(value),
          )
        }
      }

      document.head.appendChild(script)

      onCleanup(() => {
        if (script.parentNode) {
          script.parentNode.removeChild(script)
        }
      })
    }

    if (typeof children === 'string') {
      const typeAttr =
        typeof attrs?.type === 'string' ? attrs.type : 'text/javascript'
      const nonceAttr =
        typeof attrs?.nonce === 'string' ? attrs.nonce : undefined
      const existingScript = Array.from(
        document.querySelectorAll('script:not([src])'),
      ).find((el) => {
        if (!(el instanceof HTMLScriptElement)) return false
        const sType = el.getAttribute('type') ?? 'text/javascript'
        const sNonce = el.getAttribute('nonce') ?? undefined
        return (
          el.textContent === children &&
          sType === typeAttr &&
          sNonce === nonceAttr
        )
      })

      if (existingScript) {
        return
      }

      const script = document.createElement('script')
      script.textContent = children

      if (attrs) {
        for (const [key, value] of Object.entries(attrs)) {
          if (value !== undefined && value !== false) {
            script.setAttribute(
              key,
              typeof value === 'boolean' ? '' : String(value),
            )
          }
        }
      }

      document.head.appendChild(script)

      onCleanup(() => {
        if (script.parentNode) {
          script.parentNode.removeChild(script)
        }
      })
    }
  })

  if (!(isServer ?? router.isServer)) {
    if (dataScript && typeof children === 'string') {
      return <script {...attrs} innerHTML={children} />
    }

    // render an empty script on the client just to avoid hydration errors
    return null
  }

  if (attrs?.src && typeof attrs.src === 'string') {
    return <script {...attrs} />
  }

  if (typeof children === 'string') {
    return <script {...attrs} innerHTML={children} />
  }

  return null
}
