import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'

const localeNames = ['zh', 'fr', 'ja', 'ru', 'vi'] as const

const airwallexKeys = [
  'Airwallex Gateway',
  'Configuration for Airwallex payment integration',
  'Configure at least one enabled business account with Base URL, Client ID, API Key, and Webhook Secret. Leave secret fields blank to keep the existing configured value.',
  'Enable Airwallex',
  'Show Airwallex recharge options when an account is ready',
  'Enable operations polling',
  'Allow background reconciliation for pending Airwallex orders',
  'Allowed payment methods',
  'Comma or space separated. Leave blank to allow all returned methods.',
  'Payment methods cache TTL (seconds)',
  'HTTP timeout (seconds)',
  'Business accounts',
  'Business line keys are used by wallet checkout and webhook URLs.',
  'Add account',
  'Enable account',
  'Business line',
  'Login As',
  'Leave blank to keep existing key',
  'Enter API key',
  'Webhook Secret',
  'Leave blank to keep existing secret',
  'Enter webhook secret',
  'Save Airwallex settings',
] as const

const dynamicAdjustmentKeys = [
  'Dynamic Adjustment',
  'Dry-run switch and audit data for channel adjustment',
  'Dynamic channel adjustment',
  'Control dry-run mode and inspect automatic channel adjustment data.',
  'Dynamic adjustment',
  'Evaluate probe results and status data periodically.',
  'Dry-run mode',
  'Record suggested actions without changing routing.',
  'Platform probes',
  'Allow aiapi114 probe unmapped channel models.',
  'Last available protection',
  'Keep the last usable channel available for a model.',
  'Adjustment interval',
  'Seconds between automatic adjustment scans.',
  'Platform probe interval',
  'Seconds between automatic platform probe scans.',
  'Priority downgrade latency',
  'Latency threshold in milliseconds for priority downgrade.',
  'Degraded weight multiplier',
  'Weight multiplier for degraded channels, from 0 to 1.',
  'Protected unhealthy multiplier',
  'Weight multiplier when the last usable channel is protected.',
  'No dynamic adjustment data yet',
  'Current overrides',
  'Adjustment logs',
  'Probe results',
] as const

const untranslatedAllowed = new Set(['Airwallex Gateway'])

function readLocale(localeName: string): Record<string, string> {
  return JSON.parse(
    readFileSync(`src/i18n/locales/${localeName}.json`, 'utf8')
  ).translation
}

describe('system settings page i18n', () => {
  for (const localeName of localeNames) {
    test(`${localeName} localizes Airwallex settings`, () => {
      const locale = readLocale(localeName)

      for (const key of airwallexKeys) {
        assert.ok(
          Object.hasOwn(locale, key),
          `${localeName} is missing "${key}"`
        )
        if (!untranslatedAllowed.has(key)) {
          assert.notEqual(locale[key], key, `${localeName} leaves "${key}" untranslated`)
        }
      }
    })

    test(`${localeName} localizes dynamic adjustment settings`, () => {
      const locale = readLocale(localeName)

      for (const key of dynamicAdjustmentKeys) {
        assert.ok(
          Object.hasOwn(locale, key),
          `${localeName} is missing "${key}"`
        )
        assert.notEqual(locale[key], key, `${localeName} leaves "${key}" untranslated`)
      }
    })
  }
})
