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
export type CaptchaProvider = 'turnstile' | 'geetest' | 'corptcha'

export type CaptchaPayload = {
  type: CaptchaProvider
  token: string
}

export type GeetestValidate = {
  lot_number: string
  captcha_output: string
  pass_token: string
  gen_time: string
}

// 将统一的人机验证载荷转换为后端路由期望的查询参数。
// Turnstile 与 Corptcha 使用单个 token，GeeTest 需要拆分为四个校验参数。
export function buildCaptchaParams(
  captcha?: CaptchaPayload
): Record<string, string> {
  if (!captcha || !captcha.token) return {}
  if (captcha.type === 'turnstile') {
    return { turnstile: captcha.token }
  }
  if (captcha.type === 'corptcha') {
    return { corptcha: captcha.token }
  }
  try {
    const validate = JSON.parse(captcha.token) as Partial<GeetestValidate>
    const params: Record<string, string> = {}
    if (validate.lot_number) params.lot_number = validate.lot_number
    if (validate.captcha_output) params.captcha_output = validate.captcha_output
    if (validate.pass_token) params.pass_token = validate.pass_token
    if (validate.gen_time) params.gen_time = validate.gen_time
    return params
  } catch {
    return {}
  }
}
