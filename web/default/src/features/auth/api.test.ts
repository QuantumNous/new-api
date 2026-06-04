import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  buildSmsRegisterCodeRequest,
  buildSmsRegisterRequest,
} from './api'

describe('SMS registration API requests', () => {
  test('builds the SMS register code request', () => {
    assert.deepEqual(
      buildSmsRegisterCodeRequest('10000000000', 'turnstile-token'),
      {
        url: '/api/user/sms/register/code',
        data: {
          phone: '10000000000',
        },
        config: {
          params: {
            turnstile: 'turnstile-token',
          },
        },
      }
    )
  })

  test('builds the SMS register request with affiliate attribution', () => {
    assert.deepEqual(
      buildSmsRegisterRequest({
        username: 'alice',
        password: 'password123',
        phone: '10000000000',
        verification_code: '123456',
        aff_code: 'AFF-CODE',
        turnstile: 'turnstile-token',
      }),
      {
        url: '/api/user/sms/register',
        data: {
          username: 'alice',
          password: 'password123',
          phone: '10000000000',
          verification_code: '123456',
          aff_code: 'AFF-CODE',
        },
        config: {
          params: {
            turnstile: 'turnstile-token',
          },
        },
      }
    )
  })
})
