export function base64UrlToBuffer(base64url) {
  if (!base64url) return new ArrayBuffer(0);
  let padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const uintArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i += 1) {
    uintArray[i] = rawData.charCodeAt(i);
  }
  return buffer;
}

export function bufferToBase64Url(buffer) {
  if (!buffer) return '';
  const uintArray = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < uintArray.byteLength; i += 1) {
    binary += String.fromCharCode(uintArray[i]);
  }
  return window
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function prepareCredentialCreationOptions(payload) {
  const options = payload?.publicKey || payload?.PublicKey || payload?.response || payload?.Response;
  if (!options) {
    throw new Error('无法从服务端响应中解析 Passkey 注册参数');
  }
  const publicKey = {
    ...options,
    challenge: base64UrlToBuffer(options.challenge),
    user: {
      ...options.user,
      id: base64UrlToBuffer(options.user?.id),
    },
  };

  if (Array.isArray(options.excludeCredentials)) {
    publicKey.excludeCredentials = options.excludeCredentials.map((item) => ({
      ...item,
      id: base64UrlToBuffer(item.id),
    }));
  }

  if (Array.isArray(options.attestationFormats) && options.attestationFormats.length === 0) {
    delete publicKey.attestationFormats;
  }

  return publicKey;
}

export function prepareCredentialRequestOptions(payload) {
  const options = payload?.publicKey || payload?.PublicKey || payload?.response || payload?.Response;
  if (!options) {
    throw new Error('无法从服务端响应中解析 Passkey 登录参数');
  }
  const publicKey = {
    ...options,
    challenge: base64UrlToBuffer(options.challenge),
  };

  if (Array.isArray(options.allowCredentials)) {
    publicKey.allowCredentials = options.allowCredentials.map((item) => ({
      ...item,
      id: base64UrlToBuffer(item.id),
    }));
  }

  return publicKey;
}

export function buildRegistrationResult(credential) {
  if (!credential) return null;

  const { response } = credential;
  const transports = typeof response.getTransports === 'function' ? response.getTransports() : undefined;

  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    response: {
      attestationObject: bufferToBase64Url(response.attestationObject),
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      transports,
    },
    clientExtensionResults: credential.getClientExtensionResults?.() ?? {},
  };
}

export function buildAssertionResult(assertion) {
  if (!assertion) return null;

  const { response } = assertion;

  return {
    id: assertion.id,
    rawId: bufferToBase64Url(assertion.rawId),
    type: assertion.type,
    authenticatorAttachment: assertion.authenticatorAttachment,
    response: {
      authenticatorData: bufferToBase64Url(response.authenticatorData),
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      signature: bufferToBase64Url(response.signature),
      userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : null,
    },
    clientExtensionResults: assertion.getClientExtensionResults?.() ?? {},
  };
}

export async function isPasskeySupported() {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return false;
  }
  if (typeof window.PublicKeyCredential.isConditionalMediationAvailable === 'function') {
    try {
      const available = await window.PublicKeyCredential.isConditionalMediationAvailable();
      if (available) return true;
    } catch (error) {
      // ignore
    }
  }
  if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
    try {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (error) {
      return false;
    }
  }
  return true;
}

