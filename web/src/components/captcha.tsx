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
import type { CaptchaProvider } from '@/lib/captcha'

import { Corptcha } from './corptcha'
import { GeeTest } from './geetest'
import { Turnstile } from './turnstile'

interface CaptchaProps {
  provider: CaptchaProvider | null
  captchaKey: string
  purpose?: string
  onVerify: (token: string) => void
  onExpire?: () => void
  className?: string
}

/**
 * 机器人验证统一组件，根据当前启用的渠道渲染对应的验证码组件。
 */
export function Captcha({
  provider,
  captchaKey,
  purpose,
  onVerify,
  onExpire,
  className,
}: CaptchaProps) {
  if (provider === 'turnstile') {
    return (
      <Turnstile
        siteKey={captchaKey}
        onVerify={onVerify}
        onExpire={onExpire}
        className={className}
      />
    )
  }
  if (provider === 'geetest') {
    return (
      <GeeTest
        captchaId={captchaKey}
        onVerify={onVerify}
        onExpire={onExpire}
        className={className}
      />
    )
  }
  if (provider === 'corptcha') {
    return (
      <Corptcha
        siteKey={captchaKey}
        purpose={purpose ?? 'login'}
        onVerify={onVerify}
        onExpire={onExpire}
        className={className}
      />
    )
  }
  return null
}
