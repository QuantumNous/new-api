import test from 'node:test';
import assert from 'node:assert/strict';

import { getStatusOptionPatch } from './statusOption.js';

test('maps footer option updates to footer_html status data', () => {
  assert.deepEqual(
    getStatusOptionPatch('Footer', 'https://veriai.chat/landing/footer.html'),
    {
      statusKey: 'footer_html',
      storageKey: 'footer_html',
      value: 'https://veriai.chat/landing/footer.html',
    },
  );
});

test('returns null for options that are not mirrored into status', () => {
  assert.equal(getStatusOptionPatch('About', '<div>About</div>'), null);
});
