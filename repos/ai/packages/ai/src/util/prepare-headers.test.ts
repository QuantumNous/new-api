import { prepareHeaders } from './prepare-headers';
import { describe, it, expect } from 'vitest';

describe('prepareHeaders', () => {
  it('should set Content-Type header if not present', () => {
    const headers = prepareHeaders({}, { 'content-type': 'application/json' });

    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('should not overwrite existing Content-Type header', () => {
    const headers = prepareHeaders(
      { 'Content-Type': 'text/html' },
      { 'content-type': 'application/json' },
    );

    expect(headers.get('Content-Type')).toBe('text/html');
  });

  it('should handle undefined init', () => {
    const headers = prepareHeaders(undefined, {
      'content-type': 'application/json',
    });

    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('should handle init headers as Headers object', () => {
    const headers = prepareHeaders(new Headers({ init: 'foo' }), {
      'content-type': 'application/json',
    });

    expect(headers.get('init')).toBe('foo');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('should handle Response object headers', () => {
    const initHeaders = { init: 'foo' };
    const response = new Response(null, {
      headers: { ...initHeaders, extra: 'bar' },
    });

    const headers = prepareHeaders(response.headers, {
      'content-type': 'application/json',
    });

    expect(headers.get('init')).toBe('foo');
    expect(headers.get('extra')).toBe('bar');
    expect(headers.get('Content-Type')).toBe('application/json');
  });
});
