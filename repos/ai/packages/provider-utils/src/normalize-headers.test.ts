import { describe, expect, it } from 'vitest';

import { normalizeHeaders } from './normalize-headers';

describe('normalizeHeaders', () => {
  it('returns empty object for undefined', () => {
    expect(normalizeHeaders(undefined)).toEqual({});
  });

  it('converts Headers instance to record', () => {
    const headers = new Headers({
      Authorization: 'Bearer token',
      'X-Feature': 'beta',
    });

    expect(normalizeHeaders(headers)).toEqual({
      authorization: 'Bearer token',
      'x-feature': 'beta',
    });
  });

  it('converts tuple array', () => {
    const headers: HeadersInit = [
      ['Authorization', 'Bearer token'],
      ['X-Feature', 'beta'],
      ['X-Ignore', undefined as unknown as string],
    ];

    expect(normalizeHeaders(headers)).toEqual({
      authorization: 'Bearer token',
      'x-feature': 'beta',
    });
  });

  it('converts plain record and filters nullish values', () => {
    expect(
      normalizeHeaders({
        Authorization: 'Bearer token',
        'X-Feature': undefined,
        'Content-Type': 'application/json',
      }),
    ).toEqual({
      authorization: 'Bearer token',
      'content-type': 'application/json',
    });
  });

  it('handles empty Headers instance', () => {
    const headers = new Headers();
    expect(normalizeHeaders(headers)).toEqual({});
  });

  it('converts uppercase keys to lowercase', () => {
    expect(
      normalizeHeaders({
        'CONTENT-TYPE': 'application/json',
        'X-CUSTOM-HEADER': 'test-value',
      }),
    ).toEqual({
      'content-type': 'application/json',
      'x-custom-header': 'test-value',
    });
  });
});
