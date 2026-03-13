import test from 'node:test';
import assert from 'node:assert/strict';

import { getFooterRenderMode } from './footer.js';

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
