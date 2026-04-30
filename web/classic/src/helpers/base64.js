/*
Copyright (C) 2025 QuantumNous

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
