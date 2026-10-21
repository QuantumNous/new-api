import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  getWechatPemFileKind,
  detectWechatPemKindByContent,
} from './wechat-pay-file-upload'

describe('getWechatPemFileKind (filename hint, relaxed)', () => {
  test('detects apiclient_cert.pem as certificate', () => {
    assert.equal(getWechatPemFileKind('apiclient_cert.pem'), 'cert')
  })

  test('detects apiclient_key.pem as private key', () => {
    assert.equal(getWechatPemFileKind('apiclient_key.pem'), 'key')
  })

  test('rejects unrelated pem files', () => {
    assert.equal(getWechatPemFileKind('other.pem'), null)
  })

  test('accepts browser-duplicated name "apiclient_cert (1).pem"', () => {
    assert.equal(getWechatPemFileKind('apiclient_cert (1).pem'), 'cert')
  })

  test('accepts merchant-id prefixed name', () => {
    assert.equal(getWechatPemFileKind('1746971547_apiclient_cert.pem'), 'cert')
  })

  test('accepts mixed-case name', () => {
    assert.equal(getWechatPemFileKind('APIClient_Key.PEM'), 'key')
  })

  test('accepts non-pem extension variants', () => {
    assert.equal(getWechatPemFileKind('apiclient_cert.pem.txt'), 'cert')
  })
})

describe('detectWechatPemKindByContent (authoritative)', () => {
  const CERT =
    '-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----\n'
  const PKCS8 =
    '-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n'
  const PKCS1 =
    '-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n'

  test('detects certificate content', () => {
    assert.equal(detectWechatPemKindByContent(CERT), 'cert')
  })

  test('detects PKCS#8 private key content', () => {
    assert.equal(detectWechatPemKindByContent(PKCS8), 'key')
  })

  test('detects PKCS#1 RSA private key content', () => {
    assert.equal(detectWechatPemKindByContent(PKCS1), 'key')
  })

  test('tolerates leading/trailing whitespace', () => {
    assert.equal(detectWechatPemKindByContent('\n\n  ' + CERT + '  \n'), 'cert')
  })

  test('returns null for non-PEM content', () => {
    assert.equal(detectWechatPemKindByContent('not a pem at all'), null)
  })

  test('returns null for empty content', () => {
    assert.equal(detectWechatPemKindByContent(''), null)
  })
})
