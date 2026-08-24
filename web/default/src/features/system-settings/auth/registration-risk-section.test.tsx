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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeAll, describe, expect, test } from 'bun:test'
import i18n from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { initReactI18next } from 'react-i18next'
import { BasicAuthSection } from './basic-auth-section'
import { buildBasicAuthOptionUpdates } from './basic-auth-utils'
import {
  buildRegistrationRiskOptionRequest,
  buildRegistrationRiskReleaseRequest,
  buildRegistrationDomainBlockDetailUrl,
  unwrapRegistrationRiskResponse,
} from './registration-risk-api'
import { RegistrationRiskIncidentTable } from './registration-risk-incident-table'

describe('registration domain risk settings', () => {
  beforeAll(async () => {
    await i18n.use(initReactI18next).init({
      lng: 'en',
      fallbackLng: 'en',
      resources: { en: { translation: {} } },
      interpolation: { escapeValue: false },
    })
  })

  test('serializes all risk settings for one atomic bulk update', () => {
    expect(
      buildRegistrationRiskOptionRequest({
        domainRiskEnabled: true,
        windowHours: 12,
        threshold: 8,
        trustedDomains: ' Example.com\ncompany.com\nexample.com ',
        emailBlacklistPatterns:
          ' (?i)^fk[a-z0-9]{12}@[a-z0-9.]+$\n^blocked@example\\.com$ ',
      })
    ).toEqual({
      options: [
        {
          key: 'registration_security.domain_risk_enabled',
          value: 'true',
        },
        {
          key: 'registration_security.domain_risk_window_hours',
          value: '12',
        },
        {
          key: 'registration_security.domain_risk_threshold',
          value: '8',
        },
        {
          key: 'registration_security.trusted_email_domains',
          value: '["example.com","company.com"]',
        },
        {
          key: 'registration_security.email_blacklist_patterns',
          value:
            '["(?i)^fk[a-z0-9]{12}@[a-z0-9.]+$","^blocked@example\\\\.com$"]',
        },
      ],
    })
  })

  test('places the subdomain rejection switch with the email whitelist controls', () => {
    const queryClient = new QueryClient()
    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <BasicAuthSection
          defaultValues={{
            PasswordLoginEnabled: true,
            PasswordRegisterEnabled: true,
            EmailVerificationEnabled: false,
            RegisterEnabled: true,
            EmailDomainRestrictionEnabled: false,
            EmailAliasRestrictionEnabled: false,
            EmailDomainWhitelist: '',
            'registration_security.reject_subdomain_email_domains': false,
          }}
        />
      </QueryClientProvider>
    )

    const whitelistIndex = html.indexOf('Email Domain Whitelist')
    const subdomainIndex = html.indexOf('Reject Email Subdomains')

    expect(whitelistIndex).toBeGreaterThan(-1)
    expect(subdomainIndex).toBeGreaterThan(whitelistIndex)
  })

  test('serializes the subdomain switch to the flat server option key', () => {
    const defaults = {
      PasswordLoginEnabled: true,
      PasswordRegisterEnabled: true,
      EmailVerificationEnabled: false,
      RegisterEnabled: true,
      EmailDomainRestrictionEnabled: false,
      EmailAliasRestrictionEnabled: false,
      EmailDomainWhitelist: '',
      rejectSubdomainEmailDomains: false,
    }

    expect(
      buildBasicAuthOptionUpdates(defaults, {
        ...defaults,
        rejectSubdomainEmailDomains: true,
      })
    ).toContainEqual({
      key: 'registration_security.reject_subdomain_email_domains',
      value: true,
    })
  })

  test('does not resubmit an unchanged multiline email whitelist', () => {
    const defaults = {
      PasswordLoginEnabled: true,
      PasswordRegisterEnabled: true,
      EmailVerificationEnabled: false,
      RegisterEnabled: true,
      EmailDomainRestrictionEnabled: false,
      EmailAliasRestrictionEnabled: false,
      EmailDomainWhitelist: 'example.com\ncompany.com',
      rejectSubdomainEmailDomains: false,
    }

    expect(buildBasicAuthOptionUpdates(defaults, defaults)).toEqual([])
  })

  test('updates the email whitelist before enabling domain restriction', () => {
    const defaults = {
      PasswordLoginEnabled: true,
      PasswordRegisterEnabled: true,
      EmailVerificationEnabled: false,
      RegisterEnabled: true,
      EmailDomainRestrictionEnabled: false,
      EmailAliasRestrictionEnabled: false,
      EmailDomainWhitelist: '',
      rejectSubdomainEmailDomains: false,
    }

    const updates = buildBasicAuthOptionUpdates(defaults, {
      ...defaults,
      EmailDomainRestrictionEnabled: true,
      EmailDomainWhitelist: 'example.com',
    })

    expect(updates.map((update) => update.key)).toEqual([
      'EmailDomainWhitelist',
      'EmailDomainRestrictionEnabled',
    ])
  })

  test('renders active incident evidence needed for recovery', () => {
    const html = renderToStaticMarkup(
      <RegistrationRiskIncidentTable
        incidents={[
          {
            id: 17,
            domain: 'campaign.example',
            window_hours: 24,
            threshold: 10,
            observed_count: 12,
            window_started_at: 1_700_000_000,
            blocked_at: 1_700_003_600,
            released_at: 0,
            released_by: 0,
            restore_users: false,
            affected_user_count: 9,
          },
        ]}
        onInspect={() => undefined}
        onRecover={() => undefined}
        onReleaseOnly={() => undefined}
      />
    )

    expect(html).toContain('campaign.example')
    expect(html).toContain('12 / 10')
    expect(html).toContain('9')
    expect(html).toContain('Blocked')
  })

  test('maps fast false-positive recovery to restore and trust', () => {
    expect(buildRegistrationRiskReleaseRequest('restore-and-trust')).toEqual({
      restore_users: true,
      add_trusted_domain: true,
    })
  })

  test('maps unblock-only recovery without restoring or trusting', () => {
    expect(buildRegistrationRiskReleaseRequest('release-only')).toEqual({
      restore_users: false,
      add_trusted_domain: false,
    })
  })

  test('throws when an incident API returns a failed response envelope', () => {
    expect(() =>
      unwrapRegistrationRiskResponse({
        success: false,
        message: 'database unavailable',
        data: undefined,
      })
    ).toThrow('database unavailable')
  })

  test('builds a paginated affected-user detail request', () => {
    expect(buildRegistrationDomainBlockDetailUrl(17, 3, 20)).toBe(
      '/api/registration-domain-risk/blocks/17?p=3&page_size=20'
    )
  })
})
