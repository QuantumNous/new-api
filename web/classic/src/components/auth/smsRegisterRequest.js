export function buildSmsRegisterCodeRequest(phone, turnstileToken = '') {
  return {
    url: '/api/user/sms/register/code',
    data: {
      phone,
    },
    config: {
      params: {
        turnstile: turnstileToken || '',
      },
    },
  };
}

export function buildSmsRegisterRequest({
  username,
  password,
  phone,
  verificationCode,
  affCode,
  turnstileToken = '',
}) {
  return {
    url: '/api/user/sms/register',
    data: {
      username,
      password,
      phone,
      verification_code: verificationCode,
      aff_code: affCode,
    },
    config: {
      params: {
        turnstile: turnstileToken || '',
      },
    },
  };
}

export function buildSmsLoginCodeRequest(phone, turnstileToken = '') {
  return {
    url: '/api/user/sms/login/code',
    data: {
      phone,
    },
    config: {
      params: {
        turnstile: turnstileToken || '',
      },
    },
  };
}

export function buildSmsPhoneLoginRequest({
  phone,
  verificationCode,
  turnstileToken = '',
}) {
  return {
    url: '/api/user/login/phone',
    data: {
      phone,
      verification_code: verificationCode,
    },
    config: {
      params: {
        turnstile: turnstileToken || '',
      },
    },
  };
}
