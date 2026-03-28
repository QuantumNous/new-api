import { describe, expect, test } from 'bun:test';

import {
  postIframeContext,
  postLanguageToIframe,
  postThemeModeToIframe,
} from './iframeContext.js';

describe('postIframeContext', () => {
  test('posts only the context fields that are provided', () => {
    const calls = [];
    const iframe = {
      contentWindow: {
        postMessage(payload, targetOrigin) {
          calls.push({ payload, targetOrigin });
        },
      },
    };

    expect(
      postIframeContext(iframe, {
        themeMode: 'dark',
        lang: 'en',
      }),
    ).toBe(true);

    expect(calls).toEqual([
      {
        payload: { themeMode: 'dark' },
        targetOrigin: '*',
      },
      {
        payload: { lang: 'en' },
        targetOrigin: '*',
      },
    ]);
  });

  test('skips missing context fields', () => {
    const calls = [];
    const iframe = {
      contentWindow: {
        postMessage(payload, targetOrigin) {
          calls.push({ payload, targetOrigin });
        },
      },
    };

    expect(
      postIframeContext(iframe, {
        themeMode: 'light',
      }),
    ).toBe(true);

    expect(calls).toEqual([
      {
        payload: { themeMode: 'light' },
        targetOrigin: '*',
      },
    ]);
  });

  test('returns false when the iframe window is unavailable', () => {
    expect(postIframeContext(null, { lang: 'zh-CN' })).toBe(false);
  });
});

describe('theme and language helpers', () => {
  test('posts only theme mode when requested', () => {
    const calls = [];
    const iframe = {
      contentWindow: {
        postMessage(payload, targetOrigin) {
          calls.push({ payload, targetOrigin });
        },
      },
    };

    expect(postThemeModeToIframe(iframe, 'dark')).toBe(true);

    expect(calls).toEqual([
      {
        payload: { themeMode: 'dark' },
        targetOrigin: '*',
      },
    ]);
  });

  test('posts only language when requested', () => {
    const calls = [];
    const iframe = {
      contentWindow: {
        postMessage(payload, targetOrigin) {
          calls.push({ payload, targetOrigin });
        },
      },
    };

    expect(postLanguageToIframe(iframe, 'fr')).toBe(true);

    expect(calls).toEqual([
      {
        payload: { lang: 'fr' },
        targetOrigin: '*',
      },
    ]);
  });
});
