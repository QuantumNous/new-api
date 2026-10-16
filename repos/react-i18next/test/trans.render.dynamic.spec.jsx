import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import './i18n';
import { Trans } from '../src';

describe('Trans should render nested components', () => {
  // beforeAll(() => {
  //   vitest.spyOn(console, 'error').mockImplementation(() => { });
  // })

  afterEach(() => {
    cleanup();
    // vitest.clearAllMocks();
  });

  it('should render dynamic ul as components property', () => {
    const list = ['li1', 'li2'];

    function TestComponent() {
      return (
        <Trans
          i18nKey="testTrans4KeyWithNestedComponent"
          components={[
            <ul>
              {list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>,
          ]}
        />
      );
    }
    const { container } = render(<TestComponent />);

    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        Result should be a list: 
        <ul>
          <li>
            li1
          </li>
          <li>
            li2
          </li>
        </ul>
      </div>
    `);
  });

  it('should render dynamic ul as components property when pass as a children', () => {
    const list = ['li1', 'li2'];

    function TestComponent() {
      return (
        <Trans i18nKey="testTrans5KeyWithNestedComponent">
          My list:
          <ul i18nIsDynamicList>
            {list.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Trans>
      );
    }
    const { container } = render(<TestComponent />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        Result should be a list: 
        <ul>
          <li>
            li1
          </li>
          <li>
            li2
          </li>
        </ul>
      </div>
    `);
  });

  it('should render dynamic Elements correctly', () => {
    const dynamicContent = <div>testing</div>;

    function TestComponent() {
      return (
        <Trans>
          My dynamic content:
          <React.Fragment i18nIsDynamicList>{dynamicContent}</React.Fragment>
        </Trans>
      );
    }
    const { container } = render(<TestComponent />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        My dynamic content:
        <div>
          testing
        </div>
      </div>
    `);
  });

  it('should render dynamic strings correctly', () => {
    const dynamicContent = 'testing';

    function TestComponent() {
      return (
        <Trans>
          My dynamic content: <React.Fragment i18nIsDynamicList>{dynamicContent}</React.Fragment>
        </Trans>
      );
    }
    const { container } = render(<TestComponent />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        My dynamic content: 
        testing
      </div>
    `);
  });

  // #1915 — cloned DOM elements without i18nIsDynamicList must not receive any
  // internal prop (previously leaked via override.i18nIsDynamicList = undefined)
  it('should not emit unknown-prop warnings for plain DOM components', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function TestComponent() {
      return (
        <Trans
          defaults="By continuing you agree to our <termsLink>Terms</termsLink> and <policyLink>Policy</policyLink>."
          components={{
            // eslint-disable-next-line jsx-a11y/control-has-associated-label, jsx-a11y/anchor-has-content
            termsLink: <a href="https://example.com" target="_blank" rel="noreferrer" />,
            // eslint-disable-next-line jsx-a11y/control-has-associated-label, jsx-a11y/anchor-has-content
            policyLink: <a href="https://example.com" target="_blank" rel="noreferrer" />,
          }}
        />
      );
    }
    render(<TestComponent />);
    const warnings = errorSpy.mock.calls.map((args) => String(args[0]));
    expect(warnings.some((w) => w.includes('i18nIsDynamicList'))).toBe(false);
    errorSpy.mockRestore();
  });
});
