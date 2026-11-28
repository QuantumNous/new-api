import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { I18nextProvider } from '../../src/I18nextProvider';
import { IcuTrans } from '../../src/IcuTrans';
import i18n from '../i18n';

describe('IcuTrans', () => {
  beforeAll(async () => {
    await i18n.init();
  });

  afterEach(() => {
    cleanup();
  });

  describe('basic rendering', () => {
    it('should render plain text without tags', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans i18nKey="test.plain" defaultTranslation="Hello World" content={[]} />
        </I18nextProvider>,
      );

      expect(container.textContent).toBe('Hello World');
    });

    it('should render text with a single tag', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.single"
            defaultTranslation="Click <0>here</0> to continue"
            content={[{ type: 'strong', props: {} }]}
          />
        </I18nextProvider>,
      );

      expect(container.innerHTML).toContain('<strong>here</strong>');
      expect(container.textContent).toBe('Click here to continue');
    });

    it('should render text with multiple tags', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.multiple"
            defaultTranslation="Text with <0>bold</0> and <1>italic</1>"
            content={[
              { type: 'strong', props: {} },
              { type: 'em', props: {} },
            ]}
          />
        </I18nextProvider>,
      );

      expect(container.innerHTML).toContain('<strong>bold</strong>');
      expect(container.innerHTML).toContain('<em>italic</em>');
      expect(container.textContent).toBe('Text with bold and italic');
    });

    it('should render nested tags', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.nested"
            defaultTranslation="<0>Outer <1>inner</1> text</0>"
            content={[
              { type: 'div', props: {} },
              { type: 'strong', props: {} },
            ]}
          />
        </I18nextProvider>,
      );

      expect(container.innerHTML).toContain('<div>');
      expect(container.innerHTML).toContain('<strong>inner</strong>');
      expect(container.textContent).toBe('Outer inner text');
    });
  });

  describe('component props', () => {
    it('should preserve component props', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.props"
            defaultTranslation="Go <0>here</0>"
            content={[{ type: 'a', props: { href: '/test', className: 'link' } }]}
          />
        </I18nextProvider>,
      );

      const link = container.querySelector('a');
      expect(link).toBeTruthy();
      expect(link.getAttribute('href')).toBe('/test');
      expect(link.getAttribute('class')).toBe('link');
      expect(link.textContent).toBe('here');
    });

    it('should support data attributes', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.data"
            defaultTranslation="Click <0>button</0>"
            content={[{ type: 'button', props: { 'data-testid': 'btn', 'data-action': 'submit' } }]}
          />
        </I18nextProvider>,
      );

      const button = container.querySelector('button');
      expect(button.getAttribute('data-testid')).toBe('btn');
      expect(button.getAttribute('data-action')).toBe('submit');
    });

    it('should support event handlers in props', () => {
      const handleClick = vi.fn();
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.events"
            defaultTranslation="Click <0>me</0>"
            content={[{ type: 'button', props: { onClick: handleClick } }]}
          />
        </I18nextProvider>,
      );

      const button = container.querySelector('button');
      button.click();
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('React components', () => {
    it('should render custom React components', () => {
      function CustomButton({ children, color }) {
        return (
          <button type="button" style={{ color }}>
            {children}
          </button>
        );
      }

      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.custom"
            defaultTranslation="Click <0>here</0>"
            content={[{ type: CustomButton, props: { color: 'red' } }]}
          />
        </I18nextProvider>,
      );

      const button = container.querySelector('button');
      expect(button).toBeTruthy();
      expect(button.style.color).toBe('red');
      expect(button.textContent).toBe('here');
    });

    it('should render self-closing components', () => {
      function Icon({ name }) {
        return <i className={`icon-${name}`} />;
      }

      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.icon"
            defaultTranslation="Documentation <0></0>"
            content={[{ type: Icon, props: { name: 'external' } }]}
          />
        </I18nextProvider>,
      );

      const icon = container.querySelector('i');
      expect(icon).toBeTruthy();
      expect(icon.className).toBe('icon-external');
    });
  });

  describe('interpolation values', () => {
    it('should support variable interpolation', () => {
      // Note: In real usage, i18n would handle interpolation before IcuTrans receives it
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.interpolation"
            defaultTranslation="Hello World"
            content={[]}
            values={{ name: 'World' }}
          />
        </I18nextProvider>,
      );

      expect(container.textContent).toBeTruthy();
    });

    it('should pass values to i18n t function', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.values"
            defaultTranslation="Count: <0>5</0> items"
            content={[{ type: 'strong', props: {} }]}
            values={{ count: 5 }}
          />
        </I18nextProvider>,
      );

      expect(container.textContent).toBeTruthy();
    });
  });

  describe('HTML entities', () => {
    it('should decode HTML entities in translations', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.entities"
            defaultTranslation="&copy; 2024 &amp; <0>more</0>"
            content={[{ type: 'strong', props: {} }]}
          />
        </I18nextProvider>,
      );

      expect(container.textContent).toContain('©');
      expect(container.textContent).toContain('&');
      expect(container.textContent).toContain('more');
    });

    it('should decode entities in nested content', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.nested.entities"
            defaultTranslation="<0>Price: &euro;50 &ndash; &euro;100</0>"
            content={[{ type: 'span', props: {} }]}
          />
        </I18nextProvider>,
      );

      expect(container.textContent).toContain('€50');
      expect(container.textContent).toContain('€100');
      expect(container.textContent).toContain('–');
    });
  });

  describe('namespaces', () => {
    it('should support single namespace', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.ns"
            defaultTranslation="Namespace test"
            content={[]}
            ns="translation"
          />
        </I18nextProvider>,
      );

      expect(container.textContent).toBeTruthy();
    });

    it('should support multiple namespaces', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.ns.array"
            defaultTranslation="Multi namespace"
            content={[]}
            ns={['common', 'translation']}
          />
        </I18nextProvider>,
      );

      expect(container.textContent).toBeTruthy();
    });
  });

  describe('complex scenarios', () => {
    it('should handle deeply nested structures', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.deep"
            defaultTranslation="<0><1><2>Deep nesting</2></1></0>"
            content={[
              { type: 'div', props: {} },
              { type: 'span', props: {} },
              { type: 'strong', props: {} },
            ]}
          />
        </I18nextProvider>,
      );

      expect(container.innerHTML).toContain('<div>');
      expect(container.innerHTML).toContain('<span>');
      expect(container.innerHTML).toContain('<strong>Deep nesting</strong>');
    });

    it('should handle mixed content with text and components', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.mixed"
            defaultTranslation="Start <0>bold</0> middle <1>italic</1> end"
            content={[
              { type: 'strong', props: {} },
              { type: 'em', props: {} },
            ]}
          />
        </I18nextProvider>,
      );

      expect(container.textContent).toBe('Start bold middle italic end');
      expect(container.innerHTML).toContain('<strong>bold</strong>');
      expect(container.innerHTML).toContain('<em>italic</em>');
    });

    it('should handle multiple uses of the same tag number', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.reuse"
            defaultTranslation="<0>First</0> and <0>second</0>"
            content={[{ type: 'strong', props: {} }]}
          />
        </I18nextProvider>,
      );

      const strongs = container.querySelectorAll('strong');
      expect(strongs).toHaveLength(2);
      expect(strongs[0].textContent).toBe('First');
      expect(strongs[1].textContent).toBe('second');
    });

    it('should handle adjacent tags without text between', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.adjacent"
            defaultTranslation="<0>First</0><1>Second</1>"
            content={[
              { type: 'span', props: {} },
              { type: 'strong', props: {} },
            ]}
          />
        </I18nextProvider>,
      );

      expect(container.innerHTML).toContain('<span>First</span>');
      expect(container.innerHTML).toContain('<strong>Second</strong>');
      expect(container.textContent).toBe('FirstSecond');
    });

    it('should handle tags with only whitespace', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.whitespace"
            defaultTranslation="<0>  </0>"
            content={[{ type: 'span', props: {} }]}
          />
        </I18nextProvider>,
      );

      const span = container.querySelector('span');
      expect(span).toBeTruthy();
      expect(span.textContent).toBe('  ');
    });
  });

  describe('nested children in declarations', () => {
    it('should handle nested children declarations', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.nested.decl"
            defaultTranslation="<0><0>Item 1</0><1>Item 2</1></0>"
            content={[
              {
                type: 'ul',
                props: {
                  children: [
                    { type: 'li', props: {} },
                    { type: 'li', props: {} },
                  ],
                },
              },
            ]}
          />
        </I18nextProvider>,
      );

      const ul = container.querySelector('ul');
      expect(ul).toBeTruthy();
      const lis = ul.querySelectorAll('li');
      expect(lis).toHaveLength(2);
      expect(lis[0].textContent).toBe('Item 1');
      expect(lis[1].textContent).toBe('Item 2');
    });

    it('should handle nested declarations with different depths', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.complex.nested"
            defaultTranslation="<0>Text and <0>nested code</0></0>"
            content={[
              {
                type: 'div',
                props: {
                  style: { padding: '10px' },
                  children: [{ type: 'code', props: {} }],
                },
              },
            ]}
          />
        </I18nextProvider>,
      );

      const div = container.querySelector('div');
      expect(div).toBeTruthy();
      expect(div.style.padding).toBe('10px');
      const code = div.querySelector('code');
      expect(code).toBeTruthy();
      expect(code.textContent).toBe('nested code');
    });
  });

  describe('error handling', () => {
    it('should handle rendering errors gracefully with mismatched tags', () => {
      // Force an error by providing mismatched tags - renderTranslation will throw
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.error.mismatched"
            defaultTranslation="<0>Text</1>"
            content={[{ type: 'div', props: {} }]}
          />
        </I18nextProvider>,
      );

      // Should fallback to showing the translation string when error occurs
      expect(container.textContent).toBe('<0>Text</1>');
    });

    it('should handle missing translation key', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="nonexistent.key"
            defaultTranslation="Fallback <0>text</0>"
            content={[{ type: 'strong', props: {} }]}
          />
        </I18nextProvider>,
      );

      // Should use defaultTranslation
      expect(container.textContent).toBe('Fallback text');
    });

    it('should handle empty content array', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans i18nKey="test.empty" defaultTranslation="No components" content={[]} />
        </I18nextProvider>,
      );

      expect(container.textContent).toBe('No components');
    });

    it('should handle missing declarations for tags', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.missing"
            defaultTranslation="<0>text</0> and <1>more</1>"
            content={[{ type: 'strong', props: {} }]} // Only one declaration for two tags
          />
        </I18nextProvider>,
      );

      // Should render first tag correctly
      expect(container.innerHTML).toContain('<strong>text</strong>');
      // Second tag should be treated as literal text
      expect(container.textContent).toContain('and');
      expect(container.textContent).toContain('more');
    });
  });

  describe('edge cases', () => {
    it('should handle empty translation', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans i18nKey="test.empty.trans" defaultTranslation="" content={[]} />
        </I18nextProvider>,
      );

      expect(container.textContent).toBe('');
    });

    it('should handle translation with only tags', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.only.tags"
            defaultTranslation="<0></0><1></1>"
            content={[
              { type: 'span', props: { className: 'a' } },
              { type: 'span', props: { className: 'b' } },
            ]}
          />
        </I18nextProvider>,
      );

      const spans = container.querySelectorAll('span');
      expect(spans).toHaveLength(2);
      expect(spans[0].className).toBe('a');
      expect(spans[1].className).toBe('b');
    });

    it('should handle Unicode characters', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.unicode"
            defaultTranslation="Hello 世界 <0>🌍</0>"
            content={[{ type: 'span', props: {} }]}
          />
        </I18nextProvider>,
      );

      expect(container.textContent).toContain('世界');
      expect(container.textContent).toContain('🌍');
    });

    it('should handle special characters', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.special"
            defaultTranslation="Test: <0>$100 + 50% = $150</0>"
            content={[{ type: 'code', props: {} }]}
          />
        </I18nextProvider>,
      );

      expect(container.textContent).toBe('Test: $100 + 50% = $150');
    });

    it('should preserve whitespace', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.whitespace.preserve"
            defaultTranslation="Text   with   <0>multiple   spaces</0>"
            content={[{ type: 'span', props: {} }]}
          />
        </I18nextProvider>,
      );

      expect(container.textContent).toContain('   ');
      expect(container.textContent).toContain('multiple   spaces');
    });

    it('should handle newlines', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.newlines"
            defaultTranslation="Line 1\nLine 2\n<0>Line 3</0>"
            content={[{ type: 'div', props: {} }]}
          />
        </I18nextProvider>,
      );

      expect(container.textContent).toContain('Line 1');
      expect(container.textContent).toContain('Line 2');
      expect(container.textContent).toContain('Line 3');
    });
  });

  describe('real-world examples', () => {
    it('should render a link with icon', () => {
      function Icon({ name }) {
        return <i className={`icon-${name}`} />;
      }

      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="docs.link"
            defaultTranslation="See <0>documentation <1></1></0> for details"
            content={[
              { type: 'a', props: { href: '#docs' } },
              { type: Icon, props: { name: 'external' } },
            ]}
          />
        </I18nextProvider>,
      );

      const link = container.querySelector('a');
      expect(link).toBeTruthy();
      expect(link.getAttribute('href')).toBe('#docs');
      expect(link.textContent).toContain('documentation');

      const icon = link.querySelector('i');
      expect(icon).toBeTruthy();
      expect(icon.className).toBe('icon-external');
    });

    it('should render formatted text', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="format.text"
            defaultTranslation="Welcome to <0>React</0>! It's <1>amazing</1>."
            content={[
              { type: 'strong', props: { style: { color: 'blue' } } },
              { type: 'em', props: {} },
            ]}
          />
        </I18nextProvider>,
      );

      const strong = container.querySelector('strong');
      expect(strong).toBeTruthy();
      expect(strong.style.color).toBe('blue');
      expect(strong.textContent).toBe('React');

      const em = container.querySelector('em');
      expect(em).toBeTruthy();
      expect(em.textContent).toBe('amazing');
    });

    it('should render copyright notice', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="footer.copyright"
            defaultTranslation="&copy; 2024 <0>Company Name</0>. All rights reserved&reg;."
            content={[{ type: 'strong', props: {} }]}
          />
        </I18nextProvider>,
      );

      expect(container.textContent).toContain('©');
      expect(container.textContent).toContain('Company Name');
      expect(container.textContent).toContain('®');
    });

    it('should render call-to-action', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="cta.signup"
            defaultTranslation="Ready to start? <0>Sign up now</0> and get 50% off!"
            content={[{ type: 'a', props: { href: '/signup', className: 'btn btn-primary' } }]}
          />
        </I18nextProvider>,
      );

      const link = container.querySelector('a');
      expect(link).toBeTruthy();
      expect(link.getAttribute('href')).toBe('/signup');
      expect(link.className).toContain('btn');
      expect(link.textContent).toBe('Sign up now');
    });
  });

  describe('displayName', () => {
    it('should have correct displayName', () => {
      expect(IcuTrans.displayName).toBe('IcuTrans');
    });
  });

  describe('deeply nested complex scenario with ICU MessageFormat', () => {
    it('should handle complex ICU translation with plural, select, number, and date - scenario 1', () => {
      // This will trigger: plural "other" branch and select "other" branch
      const now = new Date(2025, 9, 13);
      const count = 1;
      const selectInput = 'other';
      const numbers = 41;

      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="examples.complex-trans"
            defaultTranslation="<0>exciting!</0>{count, plural, =0 { hi there <1>friend</1> } other { woweee even supports nested {numbers, number} } } and {selectInput, select, thing { another nested thing <2>with regular text and a date: <0>{now, date}</0></2> } other {and the fallback <3><0>one</0><1>two</1></3>}}"
            content={[
              { type: 'strong' }, // <0>exciting!</0>
              { type: 'strong' }, // <1>friend</1> (in plural =0 branch)
              {
                type: 'div',
                props: {
                  style: { color: 'red' },
                  children: [
                    { type: 'code' }, // <0> inside div - date display
                  ],
                },
              }, // <2> (in select "thing" branch)
              {
                type: 'ul',
                props: {
                  children: [
                    { type: 'li' }, // <0> inside ul
                    { type: 'li' }, // <1> inside ul
                  ],
                },
              }, // <3> (in select "other" branch)
            ]}
            values={{ count, numbers, selectInput, now }}
          />
        </I18nextProvider>,
      );

      // With the given values, ICU should process to:
      // "<0>exciting!</0> woweee even supports nested {numbers} and the fallback <3><0>one</0><1>two</1></3>"
      expect(container.textContent).toContain('exciting!');
      expect(container.textContent).toContain('and the fallback');
      const ul = container.querySelector('ul');
      expect(ul).toBeTruthy();
    });

    it('should handle complex ICU translation - scenario 2: count=0 branch', () => {
      // With count=0, this triggers the "=0" branch of plural
      const now = new Date(2025, 9, 13);
      const count = 0;
      const selectInput = 'other';
      const numbers = 41;

      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="examples.complex-trans-zero"
            defaultTranslation="<0>exciting!</0>{count, plural, =0 { hi there <1>friend</1> } other { woweee even supports nested {numbers, number} } } and {selectInput, select, thing { another nested thing <2>with regular text and a date: <0>{now, date}</0></2> } other {and the fallback <3><0>one</0><1>two</1></3>}}"
            content={[
              { type: 'strong' }, // <0>exciting!</0>
              { type: 'strong' }, // <1>friend</1>
              {
                type: 'div',
                props: {
                  style: { color: 'red' },
                  children: [{ type: 'code' }],
                },
              },
              {
                type: 'ul',
                props: {
                  children: [{ type: 'li' }, { type: 'li' }],
                },
              },
            ]}
            values={{ count, numbers, selectInput, now }}
          />
        </I18nextProvider>,
      );

      // With count=0, should show " hi there <1>friend</1> " in the plural part
      expect(container.textContent).toContain('exciting!');
      expect(container.textContent).toContain('hi there');
      expect(container.textContent).toContain('friend');
    });

    it('should handle complex ICU translation - scenario 3: selectInput="thing" branch', () => {
      // With selectInput="thing", this triggers the "thing" branch of select
      const now = new Date(2025, 9, 13);
      const count = 1;
      const selectInput = 'thing';
      const numbers = 41;

      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="examples.complex-trans-thing"
            defaultTranslation="<0>exciting!</0>{count, plural, =0 { hi there <1>friend</1> } other { woweee even supports nested {numbers, number} } } and {selectInput, select, thing { another nested thing <2>with regular text and a date: <0>{now, date}</0></2> } other {and the fallback <3><0>one</0><1>two</1></3>}}"
            content={[
              { type: 'strong' },
              { type: 'strong' },
              {
                type: 'div',
                props: {
                  style: { color: 'red' },
                  children: [{ type: 'code' }],
                },
              },
              {
                type: 'ul',
                props: {
                  children: [{ type: 'li' }, { type: 'li' }],
                },
              },
            ]}
            values={{ count, numbers, selectInput, now }}
          />
        </I18nextProvider>,
      );

      // With selectInput="thing", should show the div with nested code for date
      expect(container.textContent).toContain('exciting!');
      expect(container.textContent).toContain('another nested thing');
      expect(container.textContent).toContain('with regular text and a date:');
      const div = container.querySelector('div[style]');
      expect(div).toBeTruthy();
    });
  });

  describe('context handling', () => {
    it('should work without I18nextProvider (using global instance)', () => {
      // Test using the component outside of I18nextProvider
      const { container } = render(
        <IcuTrans
          i18nKey="test.global"
          defaultTranslation="Global <0>test</0>"
          content={[{ type: 'strong', props: {} }]}
          i18n={i18n}
        />,
      );

      expect(container.textContent).toBe('Global test');
    });

    it('should use context when available', () => {
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <IcuTrans
            i18nKey="test.context"
            defaultTranslation="Context <0>test</0>"
            content={[{ type: 'em', props: {} }]}
          />
        </I18nextProvider>,
      );

      expect(container.textContent).toBe('Context test');
    });

    it('should handle missing i18n instance gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { container } = render(
        <IcuTrans i18nKey="test.no.i18n" defaultTranslation="Fallback text" content={[]} />,
      );

      // Should render the defaultTranslation
      expect(container.textContent).toBe('Fallback text');

      consoleWarnSpy.mockRestore();
    });
  });
});
