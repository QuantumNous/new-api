import { describe, it, vitest, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import i18n from './i18n';
import { withTranslation } from '../src/withTranslation';

vitest.unmock('../src/withTranslation');

describe('withTranslation', () => {
  afterEach(() => {
    cleanup();
  });

  class TestComponent extends React.Component {
    render() {
      const { t, i18n: instance } = this.props;
      expect(typeof t).toBe('function');
      // expect(instance).toBe(i18n);
      expect(instance.__original).toBe(i18n);

      return (
        <div>
          {t('key1')}
          {t('deepPath.deepKey1')}
        </div>
      );
    }
  }

  it('should export wrapped component', () => {
    const HocElement = withTranslation()(TestComponent);
    expect(HocElement.WrappedComponent).toBe(TestComponent);
  });

  it('should render correct content', () => {
    const HocElement = withTranslation()(TestComponent);
    const { container } = render(<HocElement />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        test
        value1
      </div>
    `);
  });

  it('should has ref', () => {
    const HocElement = withTranslation('translation', { withRef: true })(TestComponent);
    const hocRef = React.createRef();
    render(<HocElement ref={hocRef} />);
    expect(hocRef.current).not.toBeNull();
  });
});
