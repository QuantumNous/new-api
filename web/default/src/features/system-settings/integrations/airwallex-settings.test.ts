import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  parseAirwallexAccountsForForm,
  serializeAirwallexAccounts,
  parseAllowedPaymentMethods,
  formatAllowedPaymentMethods,
} from './airwallex-settings.ts'

describe('airwallex settings helpers', () => {
  test('keeps configured secrets when secret inputs are left blank', () => {
    const accounts = parseAirwallexAccountsForForm(`{
      "b2c": {
        "enabled": true,
        "base_url": "https://api.airwallex.com",
        "client_id": "client-id",
        "api_key": "***configured***",
        "login_as": "merchant@example.com",
        "webhook_secret": "***configured***"
      }
    }`)

    assert.equal(accounts.length, 1)
    assert.equal(accounts[0].apiKeyConfigured, true)
    assert.equal(accounts[0].webhookSecretConfigured, true)
    assert.equal(accounts[0].api_key, '')
    assert.equal(accounts[0].webhook_secret, '')

    const serialized = serializeAirwallexAccounts(accounts)
    assert.deepEqual(JSON.parse(serialized), {
      b2c: {
        enabled: true,
        base_url: 'https://api.airwallex.com',
        client_id: 'client-id',
        api_key: '***configured***',
        login_as: 'merchant@example.com',
        webhook_secret: '***configured***',
      },
    })
  })

  test('uses newly entered secrets when rotating credentials', () => {
    const accounts = parseAirwallexAccountsForForm('{}')
    accounts[0].api_key = 'new-api-key'
    accounts[0].webhook_secret = 'new-webhook-secret'

    const serialized = serializeAirwallexAccounts(accounts)
    assert.equal(JSON.parse(serialized).b2c.api_key, 'new-api-key')
    assert.equal(
      JSON.parse(serialized).b2c.webhook_secret,
      'new-webhook-secret'
    )
  })

  test('normalizes allowed payment methods as JSON list', () => {
    assert.deepEqual(parseAllowedPaymentMethods('card, alipaycn googlepay'), [
      'card',
      'alipaycn',
      'googlepay',
    ])
    assert.equal(
      formatAllowedPaymentMethods(['card', 'alipaycn']),
      'card, alipaycn'
    )
  })
})
