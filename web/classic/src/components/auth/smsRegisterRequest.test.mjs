import { describe, expect, test } from 'bun:test';
import {
  buildSmsRegisterCodeRequest,
  buildSmsRegisterRequest,
} from './smsRegisterRequest.js';

describe('classic SMS registration request builders', () => {
  test('builds the SMS register code request', () => {
    expect(
      buildSmsRegisterCodeRequest('10000000000', 'turnstile-token'),
    ).toEqual({
      url: '/api/user/sms/register/code',
      data: {
        phone: '10000000000',
      },
      config: {
        params: {
          turnstile: 'turnstile-token',
        },
      },
    });
  });

  test('builds the SMS register request with affiliate attribution', () => {
    expect(
      buildSmsRegisterRequest({
        username: 'alice',
        password: 'password123',
        phone: '10000000000',
        verificationCode: '123456',
        affCode: 'AFF-CODE',
        turnstileToken: 'turnstile-token',
      }),
    ).toEqual({
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
    });
  });
});
