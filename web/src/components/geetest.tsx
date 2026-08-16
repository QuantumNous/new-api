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

import type { GeetestValidate } from '@/lib/captcha'

declare global {
  interface Window {
    initGeetest4?: (
      config: Record<string, unknown>,
      handler: (captcha: GeeTestCaptcha) => void
    ) => void
  }
}

interface GeeTestCaptcha {
  appendTo: (el: HTMLElement | string) => void
  onReady: (cb: () => void) => void
  onSuccess: (cb: () => void) => void
  onError: (cb: (error: unknown) => void) => void
  showCaptcha: () => void
  getValidate: () => GeetestValidate | false
  reset: () => void
  destroy: () => void
}

interface GeeTestProps {
  captchaId: string
  onVerify: (token: string) => void
  onExpire?: () => void
  className?: string
}

/**
 * 极验行为验证（第四代）组件。
 * 验证通过后将 getValidate() 结果序列化为 JSON 字符串回传，
 * 与 Turnstile 的单 token 形式统一，便于后端二次校验。
 */
export function GeeTest({
  captchaId,
  onVerify,
  onExpire,
  className,
}: GeeTestProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const captchaRef = useRef<GeeTestCaptcha | null>(null)
  const onVerifyRef = useRef(onVerify)
  const onExpireRef = useRef(onExpire)

  useEffect(() => {
    onVerifyRef.current = onVerify
    onExpireRef.current = onExpire
  }, [onVerify, onExpire])

  useEffect(() => {
    const init = () => {
      if (!containerRef.current || !window.initGeetest4) return
      window.initGeetest4(
        {
          captchaId,
          product: 'float',
          riskType: 'ai',
          // 宽度撑满宿主容器，高度固定与表单输入框一致（避免智能检测时高度塌陷）
          nativeButton: {
            width: '100%',
            height: '32px',
          },
        },
        (captcha) => {
          if (!containerRef.current) return
          captchaRef.current = captcha
          captcha.appendTo(containerRef.current)
          captcha.onSuccess(() => {
            const validate = captcha.getValidate()
            if (validate) {
              onVerifyRef.current(JSON.stringify(validate))
            }
          })
          captcha.onError(() => onExpireRef.current?.())
        }
      )
    }

    if (window.initGeetest4) {
      init()
    } else {
      const scriptId = 'gt4-geetest'
      let script = document.getElementById(scriptId) as HTMLScriptElement | null
      if (!script) {
        script = document.createElement('script')
        script.id = scriptId
        script.src = 'https://static.geetest.com/v4/gt4.js'
        script.async = true
        script.defer = true
        script.onload = () => init()
        document.head.appendChild(script)
      } else {
        script.addEventListener('load', () => init())
      }
    }

    return () => {
      captchaRef.current?.destroy()
      captchaRef.current = null
    }
  }, [captchaId])

  return <div ref={containerRef} className={className} />
}
