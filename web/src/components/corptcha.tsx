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
import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    Corptcha?: {
      render: (el: HTMLElement, config: CorptchaRenderConfig) => CorptchaWidget
    }
  }
}

interface CorptchaWidget {
  execute: () => void
  destroy?: () => void
}

interface CorptchaRenderConfig {
  apiBaseUrl: string
  siteKey: string
  purpose: string
  theme?: { mode: 'light' | 'dark' | 'auto'; accentColor?: string }
  language?: string
  onSuccess: (token: string) => void
  onError: (error: { errorCode?: string; message?: string }) => void
  onExpired: () => void
}

interface CorptchaProps {
  siteKey: string
  purpose: string
  onVerify: (token: string) => void
  onExpire?: () => void
  className?: string
}

/**
 * Corptcha 人机验证组件。
 * 验证通过后将一次性令牌 token 回传，由后端调用验证服务二次核验。
 */
export function Corptcha({
  siteKey,
  purpose,
  onVerify,
  onExpire,
  className,
}: CorptchaProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetRef = useRef<CorptchaWidget | null>(null)
  const onVerifyRef = useRef(onVerify)
  const onExpireRef = useRef(onExpire)
  const purposeRef = useRef(purpose)

  useEffect(() => {
    onVerifyRef.current = onVerify
    onExpireRef.current = onExpire
  }, [onVerify, onExpire])
  useEffect(() => {
    purposeRef.current = purpose
  }, [purpose])

  useEffect(() => {
    const render = () => {
      if (!containerRef.current || !window.Corptcha) return
      widgetRef.current = window.Corptcha.render(containerRef.current, {
        apiBaseUrl: 'https://cpt-api.25y.cn',
        siteKey,
        purpose: purposeRef.current,
        theme: { mode: 'auto' },
        onSuccess: (token: string) => onVerifyRef.current(token),
        onError: () => onExpireRef.current?.(),
        onExpired: () => onExpireRef.current?.(),
      })
    }

    if (window.Corptcha) {
      render()
    } else {
      const scriptId = 'corptcha-sdk'
      let script = document.getElementById(scriptId) as HTMLScriptElement | null
      if (!script) {
        script = document.createElement('script')
        script.id = scriptId
        script.src = 'https://res.25y.cn/corptcha/corptcha.iife.js'
        script.async = true
        script.defer = true
        script.onload = () => render()
        document.head.appendChild(script)
      } else {
        script.addEventListener('load', () => render())
      }
    }

    return () => {
      widgetRef.current?.destroy?.()
      widgetRef.current = null
    }
  }, [siteKey])

  return <div ref={containerRef} className={className} />
}
