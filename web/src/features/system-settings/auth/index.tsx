import { Accordion } from '@/components/ui/accordion'
import { useAccordionState } from '../hooks/use-accordion-state'
import { useSystemOptions, getOptionValue } from '../hooks/use-system-options'
import type { AuthSettings } from '../types'
import { BasicAuthSection } from './basic-auth-section'
import { BotProtectionSection } from './bot-protection-section'
import { OAuthSection } from './oauth-section'

const defaultAuthSettings: AuthSettings = {
  PasswordLoginEnabled: true,
  PasswordRegisterEnabled: true,
  EmailVerificationEnabled: false,
  RegisterEnabled: true,
  EmailDomainRestrictionEnabled: false,
  EmailAliasRestrictionEnabled: false,
  EmailDomainWhitelist: '',
  GitHubOAuthEnabled: false,
  GitHubClientId: '',
  GitHubClientSecret: '',
  'oidc.enabled': false,
  'oidc.client_id': '',
  'oidc.client_secret': '',
  'oidc.well_known': '',
  'oidc.authorization_endpoint': '',
  'oidc.token_endpoint': '',
  'oidc.user_info_endpoint': '',
  TelegramOAuthEnabled: false,
  TelegramBotToken: '',
  TelegramBotName: '',
  LinuxDOOAuthEnabled: false,
  LinuxDOClientId: '',
  LinuxDOClientSecret: '',
  LinuxDOMinimumTrustLevel: '0',
  WeChatAuthEnabled: false,
  WeChatServerAddress: '',
  WeChatServerToken: '',
  WeChatAccountQRCodeImageURL: '',
  TurnstileCheckEnabled: false,
  TurnstileSiteKey: '',
  TurnstileSecretKey: '',
}

export function AuthSettings() {
  const { data, isLoading } = useSystemOptions()
  const { openItems, handleAccordionChange } = useAccordionState('auth')

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='text-muted-foreground'>Loading settings...</div>
      </div>
    )
  }

  const settings = getOptionValue(data?.data, defaultAuthSettings)

  return (
    <div className='flex h-full w-full flex-1 flex-col'>
      <div className='faded-bottom h-full w-full overflow-y-auto scroll-smooth pe-4 pb-12'>
        <Accordion
          type='multiple'
          value={openItems}
          onValueChange={handleAccordionChange}
          className='space-y-2'
        >
          <BasicAuthSection
            defaultValues={{
              PasswordLoginEnabled: settings.PasswordLoginEnabled,
              PasswordRegisterEnabled: settings.PasswordRegisterEnabled,
              EmailVerificationEnabled: settings.EmailVerificationEnabled,
              RegisterEnabled: settings.RegisterEnabled,
              EmailDomainRestrictionEnabled:
                settings.EmailDomainRestrictionEnabled,
              EmailAliasRestrictionEnabled:
                settings.EmailAliasRestrictionEnabled,
              EmailDomainWhitelist: settings.EmailDomainWhitelist,
            }}
          />

          <OAuthSection
            defaultValues={{
              GitHubOAuthEnabled: settings.GitHubOAuthEnabled,
              GitHubClientId: settings.GitHubClientId,
              GitHubClientSecret: settings.GitHubClientSecret,
              'oidc.enabled': settings['oidc.enabled'],
              'oidc.client_id': settings['oidc.client_id'],
              'oidc.client_secret': settings['oidc.client_secret'],
              'oidc.well_known': settings['oidc.well_known'],
              'oidc.authorization_endpoint':
                settings['oidc.authorization_endpoint'],
              'oidc.token_endpoint': settings['oidc.token_endpoint'],
              'oidc.user_info_endpoint': settings['oidc.user_info_endpoint'],
              TelegramOAuthEnabled: settings.TelegramOAuthEnabled,
              TelegramBotToken: settings.TelegramBotToken,
              TelegramBotName: settings.TelegramBotName,
              LinuxDOOAuthEnabled: settings.LinuxDOOAuthEnabled,
              LinuxDOClientId: settings.LinuxDOClientId,
              LinuxDOClientSecret: settings.LinuxDOClientSecret,
              LinuxDOMinimumTrustLevel: settings.LinuxDOMinimumTrustLevel,
              WeChatAuthEnabled: settings.WeChatAuthEnabled,
              WeChatServerAddress: settings.WeChatServerAddress,
              WeChatServerToken: settings.WeChatServerToken,
              WeChatAccountQRCodeImageURL: settings.WeChatAccountQRCodeImageURL,
            }}
          />

          <BotProtectionSection
            defaultValues={{
              TurnstileCheckEnabled: settings.TurnstileCheckEnabled,
              TurnstileSiteKey: settings.TurnstileSiteKey,
              TurnstileSecretKey: settings.TurnstileSecretKey,
            }}
          />
        </Accordion>
      </div>
    </div>
  )
}
