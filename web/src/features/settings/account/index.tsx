import { ContentSection } from '../components/content-section'
import { EmailBindSection } from '../components/email-bind-section'
import { TwoFASection } from '../components/twofa-section'
import { AccountForm } from './account-form'

export function SettingsAccount() {
  return (
    <ContentSection
      title='Account'
      desc='Update your account settings. Set your preferred language and
          timezone.'
    >
      <AccountForm />
      <div className='mt-6 space-y-6'>
        <TwoFASection />
        <EmailBindSection />
      </div>
    </ContentSection>
  )
}
