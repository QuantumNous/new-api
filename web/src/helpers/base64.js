const toBinaryString = (text) => {
  if (typeof TextEncoder !== 'undefined') {
    const bytes = new TextEncoder().encode(text);
    let binary = '';

    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return binary;
  }

  return encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
};

export const encodeToBase64 = (value) => {
  const input = value == null ? '' : String(value);

  if (typeof window === 'undefined') {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(input, 'utf-8').toString('base64');
    }
    if (
      typeof globalThis !== 'undefined' &&
      typeof globalThis.btoa === 'function'
    ) {
      return globalThis.btoa(toBinaryString(input));
    }
    throw new Error(
      'Base64 encoding is unavailable in the current environment',
    );
  }

  return window.btoa(toBinaryString(input));
};
