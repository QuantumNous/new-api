import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import './i18n';
import { Trans } from '../src/Trans';

describe('trans using no children but props - icu case', () => {
  afterEach(() => {
    cleanup();
  });

  function TestComponent() {
    return (
      <Trans
        defaults="hello <0>{{what}}</0>"
        values={{ what: 'world' }}
        components={[<strong>universe</strong>]}
      />
    );
  }
  it('should render translated string', () => {
    const { container } = render(<TestComponent />);

    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        hello 
        <strong>
          world
        </strong>
      </div>
    `);
  });
});

describe('trans using no children but props - nested case', () => {
  function TestComponent() {
    return (
      <Trans
        defaults="<0>hello <1></1> {{what}}</0>"
        values={{ what: 'world' }}
        components={[
          <span>
            placeholder
            <br />
          </span>,
        ]}
      />
    );
  }
  it('should render translated string', () => {
    const { container } = render(<TestComponent />);

    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        <span>
          hello 
          <br />
           world
        </span>
      </div>
    `);
  });
});

describe('trans using no children but props - self closing case', () => {
  function TestComponent() {
    return <Trans defaults="hello <0/>{{what}}" values={{ what: 'world' }} components={[<br />]} />;
  }
  it('should render translated string', () => {
    const { container } = render(<TestComponent />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        hello 
        <br />
        world
      </div>
    `);
  });
});

describe('Trans should use value from translation', () => {
  it('should use value from translation if no data provided in component', () => {
    function TestComponent() {
      return (
        <Trans
          i18nKey="testTrans5KeyWithValue"
          values={{
            testValue: 'dragonfly',
          }}
          components={[<span className="awesome-styles" />]}
        />
      );
    }

    const { container } = render(<TestComponent />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        Result should be rendered within tag 
        <span
          class="awesome-styles"
        >
          dragonfly
        </span>
      </div>
    `);
  });

  it('should use value from translation if dummy data provided in component', () => {
    function TestComponent() {
      return (
        <Trans
          i18nKey="testTrans5KeyWithValue"
          values={{
            testValue: 'dragonfly',
          }}
          components={[<span className="awesome-styles">test string</span>]}
        />
      );
    }

    const { container } = render(<TestComponent />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        Result should be rendered within tag 
        <span
          class="awesome-styles"
        >
          dragonfly
        </span>
      </div>
    `);
  });
});
