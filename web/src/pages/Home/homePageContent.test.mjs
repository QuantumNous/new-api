import { describe, expect, test } from 'bun:test';

import {
  isEmbeddableHomePageURL,
  loadHomePageContent,
  postHomePageIframeContext,
  isRouteManagerHubHomePageURL,
} from './homePageContent.js';

describe('isEmbeddableHomePageURL', () => {
  test('accepts absolute http urls', () => {
    expect(isEmbeddableHomePageURL('http://example.com/hub')).toBe(true);
  });

  test('accepts absolute https urls', () => {
    expect(isEmbeddableHomePageURL('https://example.com/hub')).toBe(true);
  });

  test('accepts same-origin relative hub paths', () => {
    expect(isEmbeddableHomePageURL('/hub/')).toBe(true);
    expect(isEmbeddableHomePageURL('/custom/page')).toBe(true);
  });

  test('rejects markdown content', () => {
    expect(isEmbeddableHomePageURL('# hello')).toBe(false);
    expect(isEmbeddableHomePageURL('**bold**')).toBe(false);
  });
});

describe('isRouteManagerHubHomePageURL', () => {
  test('accepts same-origin hub paths', () => {
    expect(isRouteManagerHubHomePageURL('/hub/')).toBe(true);
    expect(isRouteManagerHubHomePageURL('/hub')).toBe(true);
    expect(isRouteManagerHubHomePageURL('/hub/?view=tasks')).toBe(true);
    expect(isRouteManagerHubHomePageURL('/hub?view=alerts')).toBe(true);
  });

  test('accepts same-origin absolute hub urls', () => {
    expect(
      isRouteManagerHubHomePageURL(
        'https://console.example.com/hub',
        'https://console.example.com',
      ),
    ).toBe(true);
    expect(
      isRouteManagerHubHomePageURL(
        'https://console.example.com/hub/',
        'https://console.example.com',
      ),
    ).toBe(true);
    expect(
      isRouteManagerHubHomePageURL(
        'https://console.example.com/hub/?view=network',
        'https://console.example.com',
      ),
    ).toBe(true);
  });

  test('rejects cross-origin hub urls', () => {
    expect(
      isRouteManagerHubHomePageURL(
        'https://hub.partner.example/hub/',
        'https://console.example.com',
      ),
    ).toBe(false);
  });

  test('rejects non-hub embeddable urls', () => {
    expect(isRouteManagerHubHomePageURL('/custom/page')).toBe(false);
    expect(
      isRouteManagerHubHomePageURL(
        'https://console.example.com/docs',
        'https://console.example.com',
      ),
    ).toBe(false);
  });
});

describe('postHomePageIframeContext', () => {
  test('posts theme and language to the iframe window when available', () => {
    const calls = [];
    const iframe = {
      contentWindow: {
        postMessage(payload, targetOrigin) {
          calls.push({ payload, targetOrigin });
        },
      },
    };

    expect(
      postHomePageIframeContext(iframe, {
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

  test('returns false when the iframe window is unavailable', () => {
    expect(
      postHomePageIframeContext(null, {
        themeMode: 'light',
        lang: 'zh-CN',
      }),
    ).toBe(false);
  });
});

describe('loadHomePageContent', () => {
  test('falls back to the provided message when the API payload is unsuccessful', async () => {
    const result = await loadHomePageContent(
      async () => ({
        success: false,
        message: 'backend failed',
        data: '',
      }),
      '加载首页内容失败...',
    );

    expect(result).toEqual({
      content: '加载首页内容失败...',
      errorMessage: 'backend failed',
      shouldPersist: false,
    });
  });

  test('falls back to the provided message when the request rejects', async () => {
    const result = await loadHomePageContent(
      async () => {
        throw new Error('network failed');
      },
      '加载首页内容失败...',
    );

    expect(result).toEqual({
      content: '加载首页内容失败...',
      errorMessage: '加载首页内容失败...',
      shouldPersist: false,
    });
  });

  test('falls back to the provided message when the API returns non-string content', async () => {
    const result = await loadHomePageContent(
      async () => ({
        success: true,
        message: '',
        data: { unsafe: true },
      }),
      '加载首页内容失败...',
    );

    expect(result).toEqual({
      content: '加载首页内容失败...',
      errorMessage: '加载首页内容失败...',
      shouldPersist: false,
    });
  });
});
