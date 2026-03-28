import { describe, expect, test } from 'bun:test';

import {
  isEmbeddableAboutPageURL,
  loadAboutPageContent,
} from './aboutPageContent.js';

describe('isEmbeddableAboutPageURL', () => {
  test('accepts absolute https urls', () => {
    expect(isEmbeddableAboutPageURL('https://example.com/about')).toBe(true);
  });

  test('rejects non-https and markdown content', () => {
    expect(isEmbeddableAboutPageURL('http://example.com/about')).toBe(false);
    expect(isEmbeddableAboutPageURL('# about')).toBe(false);
  });
});

describe('loadAboutPageContent', () => {
  test('falls back to the provided message when the API payload is unsuccessful', async () => {
    const result = await loadAboutPageContent(
      async () => ({
        success: false,
        message: 'backend failed',
        data: '',
      }),
      '加载关于内容失败...',
    );

    expect(result).toEqual({
      content: '加载关于内容失败...',
      errorMessage: 'backend failed',
      shouldPersist: false,
    });
  });

  test('falls back to the provided message when the request rejects', async () => {
    const result = await loadAboutPageContent(
      async () => {
        throw new Error('network failed');
      },
      '加载关于内容失败...',
    );

    expect(result).toEqual({
      content: '加载关于内容失败...',
      errorMessage: '加载关于内容失败...',
      shouldPersist: false,
    });
  });

  test('falls back to the provided message when the API returns non-string content', async () => {
    const result = await loadAboutPageContent(
      async () => ({
        success: true,
        message: '',
        data: ['unsafe'],
      }),
      '加载关于内容失败...',
    );

    expect(result).toEqual({
      content: '加载关于内容失败...',
      errorMessage: '加载关于内容失败...',
      shouldPersist: false,
    });
  });
});
