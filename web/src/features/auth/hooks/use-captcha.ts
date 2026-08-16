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
import i18next from 'i18next'
import { useState } from 'react'
import { toast } from 'sonner'

import { useStatus } from '@/hooks/use-status'
import type { CaptchaPayload, CaptchaProvider } from '@/lib/captcha'

/**
 * Hook for managing robot protection (Turnstile / GeeTest / Corptcha) verification.
 * 同一时刻仅启用一个渠道，按后端状态自动识别当前渠道。
 */
export function useCaptcha() {
  const { status } = useStatus()
  const [captchaToken, setCaptchaToken] = useState('')

  const isCorptchaEnabled = !!(
    status?.corptcha_check && status?.corptcha_site_id
  )
  const isGeeTestEnabled = !!(
    status?.geetest_check && status?.geetest_captcha_id
  )
  const isTurnstileEnabled = !!(
    status?.turnstile_check && status?.turnstile_site_key
  )
  let provider: CaptchaProvider | null = null
  if (isCorptchaEnabled) {
    provider = 'corptcha'
  } else if (isGeeTestEnabled) {
    provider = 'geetest'
  } else if (isTurnstileEnabled) {
    provider = 'turnstile'
  }
  const isCaptchaEnabled = provider !== null
  const captchaSiteKey =
    provider === 'corptcha'
      ? status?.corptcha_site_id || ''
      : provider === 'geetest'
        ? status?.geetest_captcha_id || ''
        : status?.turnstile_site_key || ''

  const captcha: CaptchaPayload | undefined =
    provider && captchaToken
      ? { type: provider, token: captchaToken }
      : undefined

  /**
   * Validate if captcha is ready when required
   */
  const validateCaptcha = (): boolean => {
    if (isCaptchaEnabled && !captchaToken) {
      toast.info(
        i18next.t('Please wait a moment, human check is initializing...')
      )
      return false
    }
    return true
  }

  return {
    provider,
    isCaptchaEnabled,
    captchaSiteKey,
    captchaToken,
    setCaptchaToken,
    captcha,
    validateCaptcha,
  }
}
