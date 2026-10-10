import { describe, it, vitest, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import './i18n';
import { Translation } from '../src/Translation';

vitest.unmock('../src/Translation');

describe('Translation', () => {
  afterEach(() => {
    cleanup();
  });

  function TestComponent() {
    return <Translation>{(t) => <div>{t('key1')}</div>}</Translation>;
  }

  it('should render correct content', () => {
    const { container } = render(<TestComponent />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        test
      </div>
    `);
  });
});
