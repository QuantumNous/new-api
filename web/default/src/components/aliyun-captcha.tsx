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
import { forwardRef, useCallback, useImperativeHandle, useId, useRef } from 'react'

declare global {
  interface Window {
    AliyunCaptchaConfig?: {
      region: string
      prefix: string
    }
    initAliyunCaptcha?: (options: AliyunCaptchaOptions) => void
  }
}

interface AliyunCaptchaInstance {
  refresh?: () => void
}

interface AliyunCaptchaOptions {
  SceneId: string
  mode: 'popup' | 'embed'
  element: string
  button: string
  success: (captchaVerifyParam: string) => void
  fail: (result: unknown) => void
  getInstance: (instance: AliyunCaptchaInstance) => void
  server: string[]
  slideStyle: {
    width: number
    height: number
  }
}

export interface AliyunCaptchaHandle {
  execute: () => Promise<string>
  refresh: () => void
}

interface AliyunCaptchaProps {
  enabled: boolean
  region: string
  prefix: string
  sceneId: string
  className?: string
  onError?: (message: string) => void
}

let aliyunCaptchaScriptPromise: Promise<void> | null = null

function loadAliyunCaptchaScript(): Promise<void> {
  if (window.initAliyunCaptcha) return Promise.resolve()
  if (aliyunCaptchaScriptPromise) return aliyunCaptchaScriptPromise

  aliyunCaptchaScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById('aliyun-captcha')
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener(
        'error',
        () => reject(new Error('阿里验证码脚本加载失败')),
        { once: true }
      )
      return
    }

    const script = document.createElement('script')
    script.id = 'aliyun-captcha'
    script.src = 'https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('阿里验证码脚本加载失败'))
    document.head.appendChild(script)
  })

  return aliyunCaptchaScriptPromise
}

export const AliyunCaptcha = forwardRef<AliyunCaptchaHandle, AliyunCaptchaProps>(
  function AliyunCaptcha(
    { enabled, region, prefix, sceneId, className, onError },
    ref
  ) {
    const reactId = useId().replace(/:/g, '')
    const elementId = `aliyun-captcha-element-${reactId}`
    const buttonId = `aliyun-captcha-button-${reactId}`
    const instanceRef = useRef<AliyunCaptchaInstance | null>(null)
    const initializedSceneRef = useRef('')
    const pendingResolveRef = useRef<((captchaVerifyParam: string) => void) | null>(null)
    const pendingRejectRef = useRef<((error: Error) => void) | null>(null)

    const initialize = useCallback(async () => {
      if (!enabled) return
      if (!prefix || !sceneId) {
        throw new Error('阿里验证码配置不完整')
      }
      if (initializedSceneRef.current === sceneId) return

      window.AliyunCaptchaConfig = {
        region: region || 'cn',
        prefix,
      }
      await loadAliyunCaptchaScript()
      if (!window.initAliyunCaptcha) {
        throw new Error('阿里验证码初始化方法不可用')
      }

      window.initAliyunCaptcha({
        SceneId: sceneId,
        mode: 'popup',
        element: `#${elementId}`,
        button: `#${buttonId}`,
        success: (captchaVerifyParam: string) => {
          pendingResolveRef.current?.(captchaVerifyParam)
          pendingResolveRef.current = null
          pendingRejectRef.current = null
        },
        fail: (result: unknown) => {
          const message = result instanceof Error ? result.message : '人机验证未通过，请重试'
          pendingRejectRef.current?.(new Error(message))
          pendingResolveRef.current = null
          pendingRejectRef.current = null
        },
        getInstance: (instance: AliyunCaptchaInstance) => {
          instanceRef.current = instance
        },
        server: ['captcha-esa-open.aliyuncs.com', 'captcha-esa-open-b.aliyuncs.com'],
        slideStyle: {
          width: 360,
          height: 40,
        },
      })
      initializedSceneRef.current = sceneId
    }, [buttonId, elementId, enabled, prefix, region, sceneId])

    useImperativeHandle(
      ref,
      () => ({
        execute: async () => {
          if (!enabled) return ''
          try {
            await initialize()
            return await new Promise<string>((resolve, reject) => {
              pendingResolveRef.current = resolve
              pendingRejectRef.current = reject
              document.getElementById(buttonId)?.click()
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : '人机验证初始化失败'
            onError?.(message)
            throw new Error(message)
          }
        },
        refresh: () => {
          instanceRef.current?.refresh?.()
        },
      }),
      [buttonId, enabled, initialize, onError]
    )

    if (!enabled) return null

    return (
      <div className={className}>
        <div id={elementId} />
        <button id={buttonId} type='button' className='hidden' tabIndex={-1} />
      </div>
    )
  }
)
