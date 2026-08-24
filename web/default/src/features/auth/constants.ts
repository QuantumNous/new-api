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
import { z } from 'zod'

// ============================================================================
// Form Schemas
// ============================================================================

// 中国大陆手机号正则（必须在 registerFormSchema 之前声明，避免 TDZ 引用错误）
export const CN_PHONE_REGEX = /^1[3-9]\d{9}$/

export const loginFormSchema = z.object({
  username: z
    .string()
    .min(1, 'Please enter your username, email or phone'),
  password: z.string().min(1, 'Please enter your password'),
})

/**
 * 注册表单 schema。phoneRequired 时（agent 实例强制手机验证）手机号/短信码必填；
 * 普通实例注册恢复用户名+密码，手机号/短信码不参与校验。
 */
export function createRegisterFormSchema(phoneRequired: boolean) {
  return z
    .object({
      username: z.string().min(1, 'Please enter your username'),
      phone: phoneRequired
        ? z
            .string()
            .min(1, 'Please enter your phone number')
            .regex(
              CN_PHONE_REGEX,
              'Please enter a valid mainland China phone number'
            )
        : z.string().optional(),
      smsCode: phoneRequired
        ? z.string().min(1, 'Please enter the SMS verification code')
        : z.string().optional(),
      email: z.string().optional(),
      password: z
        .string()
        .min(1, 'Please enter your password')
        .min(8, 'Password must be between 8 and 20 characters')
        .max(20, 'Password must be at most 20 characters long'),
      confirmPassword: z.string().min(1, 'Please confirm your password'),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords don't match.",
      path: ['confirmPassword'],
    })
}

export type RegisterFormValues = z.infer<
  ReturnType<typeof createRegisterFormSchema>
>

// 默认导出：普通实例（手机号非必填）。调用方按 status 重建。
export const registerFormSchema = createRegisterFormSchema(false)

export const forgotPasswordFormSchema = z.object({
  email: z.string().email({
    message: 'Please enter a valid email address',
  }),
})

export const otpFormSchema = z.object({
  otp: z.string().min(1, 'Please enter a code.'),
})

// ============================================================================
// Validation Constants
// ============================================================================

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 20
export const OTP_LENGTH = 6
export const BACKUP_CODE_LENGTH = 9 // XXXX-XXXX format
export const BACKUP_CODE_REGEX = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/i
export const OTP_REGEX = /^\d{6}$/

// ============================================================================
// Countdown Constants
// ============================================================================

export const EMAIL_VERIFICATION_COUNTDOWN = 30 // seconds
export const SMS_VERIFICATION_COUNTDOWN = 60 // seconds
export const PASSWORD_RESET_COUNTDOWN = 30 // seconds

// ============================================================================
// OAuth Constants
// ============================================================================

export const OAUTH_BIND_STORAGE_KEY = 'oauth:binding:result'
