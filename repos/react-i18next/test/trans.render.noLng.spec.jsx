import { describe, it, afterEach, assert } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import './i18nNoLng';
import { Trans } from '../src/Trans';

describe('trans simple', () => {
  afterEach(() => {
    cleanup();
  });

  it('does not throw when using the selector API with the component object and no lng set', () => {
    // https://github.com/i18next/react-i18next/issues/1867
    assert.doesNotThrow(() =>
      render(
        <Trans
          i18nKey={($) => $['testString']}
          values={{ buttonText: 'button' }}
          components={{
            el1: <a href="https://www.google.com/">Link</a>,
            el2: (
              <button variant="link" onClick={() => console.log('clicked')}>
                Button
              </button>
            ),
          }}
        />,
      ),
    );
  });
});
