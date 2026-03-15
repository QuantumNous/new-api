import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FOOTER_IFRAME_FALLBACK_HEIGHT,
  getFooterRenderMode,
  shouldResetFooterIframeHeight,
} from './footer.js';

test('uses a stable fallback height for iframe footers', () => {
  assert.equal(FOOTER_IFRAME_FALLBACK_HEIGHT, 240);
});

test('treats http and https footer values as iframe embeds', () => {
  assert.equal(
    getFooterRenderMode('https://veriai.chat/landing/footer.html'),
    'iframe',
  );
  assert.equal(getFooterRenderMode('http://example.com/footer.html'), 'iframe');
});

test('does not treat malformed http-like strings as iframe embeds', () => {
  assert.equal(getFooterRenderMode('https://exa mple.com/footer'), 'html');
});

test('treats HTML fragments as inline footer content', () => {
  assert.equal(getFooterRenderMode('<div>Footer</div>'), 'html');
});

test('falls back to the built-in footer for blank values', () => {
  assert.equal(getFooterRenderMode(''), 'default');
  assert.equal(getFooterRenderMode('   '), 'default');
  assert.equal(getFooterRenderMode(null), 'default');
});

test('resets iframe height when the footer source or mode changes', () => {
  assert.equal(
    shouldResetFooterIframeHeight(
      'iframe',
      'https://a.example/footer',
      'iframe',
      'https://b.example/footer',
    ),
    true,
  );
  assert.equal(
    shouldResetFooterIframeHeight(
      'html',
      '<div>Footer</div>',
      'iframe',
      'https://b.example/footer',
    ),
    true,
  );
  assert.equal(
    shouldResetFooterIframeHeight(
      'iframe',
      'https://a.example/footer',
      'iframe',
      'https://a.example/footer',
    ),
    false,
  );
});
