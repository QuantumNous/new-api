import { describe, expect, test } from 'bun:test';
import {
  buildSmsLoginCodeRequest,
  buildSmsPhoneLoginRequest,
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

describe('classic SMS phone login request builders', () => {
  test('builds the SMS login code request', () => {
    expect(buildSmsLoginCodeRequest('1001', 'turnstile-token')).toEqual({
      url: '/api/user/sms/login/code',
      data: {
        phone: '1001',
      },
      config: {
        params: {
          turnstile: 'turnstile-token',
        },
      },
    });
  });

  test('builds the SMS phone login request', () => {
    expect(
      buildSmsPhoneLoginRequest({
        phone: '1001',
        verificationCode: '123456',
        turnstileToken: 'turnstile-token',
      }),
    ).toEqual({
      url: '/api/user/login/phone',
      data: {
        phone: '1001',
        verification_code: '123456',
      },
      config: {
        params: {
          turnstile: 'turnstile-token',
        },
      },
    });
  });
});
