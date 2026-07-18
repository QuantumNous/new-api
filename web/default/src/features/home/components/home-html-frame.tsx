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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Renders admin-configured HomePageContent HTML in a sandboxed iframe.
 *
 * Isolated Shadow DOM + cloned app stylesheets fights self-contained pages
 * (custom <style>, particles, carousels) and can blank the home view. A blob
 * iframe matches the trusted-URL custom home path: own document, scripts
 * allowed, no host Tailwind leakage.
 */
export function HomeHtmlFrame(props: {
  html: string
  onLoad?: () => void
  iframeRef?: React.RefObject<HTMLIFrameElement | null>
}) {
  const { t } = useTranslation()
  const [src, setSrc] = useState('')

  useEffect(() => {
    const documentHtml = wrapHomeHtmlDocument(props.html)
    const blob = new Blob([documentHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    setSrc(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [props.html])

  if (!src) {
    return null
  }

  return (
    <iframe
      ref={props.iframeRef}
      src={src}
      className='h-screen w-full border-none'
      title={t('Custom Home Page')}
      sandbox='allow-forms allow-popups allow-popups-to-escape-sandbox allow-scripts allow-top-navigation-by-user-activation'
      onLoad={props.onLoad}
    />
  )
}

function wrapHomeHtmlDocument(html: string): string {
  const trimmed = html.trim()
  if (/^<!doctype html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    return trimmed
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>html,body{margin:0;padding:0;min-height:100%;background:#f7f9fc;}</style>
</head>
<body>${html}</body>
</html>`
}
