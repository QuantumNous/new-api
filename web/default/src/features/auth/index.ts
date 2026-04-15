// ============================================================================
// API Functions
// ============================================================================

export {
  login,
  login2fa,
  logout,
  register,
  sendPasswordResetEmail,
  sendEmailVerification,
  bindEmail,
  getOAuthState,
  githubOAuthStart,
  wechatLoginByCode,
} from './api'

// ============================================================================
// Types
// ============================================================================

export type {
  LoginPayload,
  LoginResponse,
  Login2FAResponse,
  TwoFAPayload,
  RegisterPayload,
  PasswordResetPayload,
  EmailVerificationPayload,
  BindEmailPayload,
  ApiResponse,
  SystemStatus,
  OAuthProvider,
  AuthFormProps,
} from './types'

// ============================================================================
// Constants & Schemas
// ============================================================================

export {
  loginFormSchema,
  registerFormSchema,
  forgotPasswordFormSchema,
  otpFormSchema,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  OTP_LENGTH,
  BACKUP_CODE_LENGTH,
  BACKUP_CODE_REGEX,
  OTP_REGEX,
  EMAIL_VERIFICATION_COUNTDOWN,
  PASSWORD_RESET_COUNTDOWN,
} from './constants'

// ============================================================================
// Utilities
// ============================================================================

export {
  buildGitHubOAuthUrl,
  buildDiscordOAuthUrl,
  buildOIDCOAuthUrl,
  buildLinuxDOOAuthUrl,
  getAvailableOAuthProviders,
  hasOAuthProviders,
} from './lib/oauth'

export {
  saveUserId,
  getUserId,
  removeUserId,
  getAffiliateCode,
  saveAffiliateCode,
} from './lib/storage'

export {
  isValidOTP,
  isValidBackupCode,
  formatBackupCode,
  cleanBackupCode,
  isValidEmail,
} from './lib/validation'

// ============================================================================
// Hooks
// ============================================================================

export { useTurnstile } from './hooks/use-turnstile'
export { useOAuthLogin } from './hooks/use-oauth-login'
export { useAuthRedirect } from './hooks/use-auth-redirect'
export { useEmailVerification } from './hooks/use-email-verification'

// ============================================================================
// Components
// ============================================================================

export { AuthLayout } from './auth-layout'
export { OAuthProviders } from './components/oauth-providers'
export { TermsFooter } from './components/terms-footer'
export { LegalConsent } from './components/legal-consent'
export { SignIn } from './sign-in'
export { SignUp } from './sign-up'
export { ForgotPassword } from './forgot-password'
export { Otp } from './otp'
