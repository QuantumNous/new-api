import { describe, it, expect } from 'vitest';
import React from 'react';

import { TranslationParserError, renderTranslation } from '../../../src/IcuTransUtils';

describe('translationParser', () => {
  it('should render plain text without any tags', () => {
    const result = renderTranslation('Hello world');

    expect(result).toEqual(['Hello world']);
  });

  it('should render text with a single tag', () => {
    const declarations = [{ type: 'strong', props: {} }];

    const result = renderTranslation('<0>bold text</0>', declarations);

    expect(result).toHaveLength(1);

    expect(React.isValidElement(result[0])).toBe(true);

    const element = result[0];

    expect(element.type).toBe('strong');

    expect(element.props.children).toBe('bold text');
  });

  it('should render tags with surrounding text content', () => {
    const declarations = [{ type: 'a', props: { href: '#' } }];

    const result = renderTranslation('Click <0>here</0> to continue', declarations);

    expect(result).toHaveLength(3);

    expect(result[0]).toBe('Click ');

    expect(React.isValidElement(result[1])).toBe(true);

    expect(result[2]).toBe(' to continue');

    const link = result[1];

    expect(link.type).toBe('a');

    expect(link.props.href).toBe('#');

    expect(link.props.children).toBe('here');
  });

  it('should render multiple tags in sequence', () => {
    const declarations = [
      { type: 'strong', props: {} },
      { type: 'em', props: {} },
    ];

    const result = renderTranslation('<0>bold</0> and <1>italic</1>', declarations);

    expect(result).toHaveLength(3);

    expect(React.isValidElement(result[0])).toBe(true);

    expect(result[1]).toBe(' and ');

    expect(React.isValidElement(result[2])).toBe(true);

    const bold = result[0];

    expect(bold.type).toBe('strong');

    expect(bold.props.children).toBe('bold');

    const italic = result[2];

    expect(italic.type).toBe('em');

    expect(italic.props.children).toBe('italic');
  });

  it('should render nested tags with proper hierarchy', () => {
    const declarations = [
      { type: 'div', props: {} },
      { type: 'strong', props: {} },
    ];

    const result = renderTranslation('<0>outer <1>inner</1> text</0>', declarations);

    expect(result).toHaveLength(1);

    const outer = result[0];

    expect(outer.type).toBe('div');

    expect(outer.props.children).toHaveLength(3);

    expect(outer.props.children[0]).toBe('outer ');

    const inner = outer.props.children[1];

    expect(React.isValidElement(inner)).toBe(true);

    expect(inner.type).toBe('strong');

    expect(inner.props.children).toBe('inner');

    expect(outer.props.children[2]).toBe(' text');
  });

  it('should preserve all component props from declarations', () => {
    const declarations = [
      {
        type: 'a',
        props: { href: '/test', className: 'link', 'data-test': 'foo' },
      },
    ];

    const result = renderTranslation('<0>link</0>', declarations);

    expect(result).toHaveLength(1);

    const element = result[0];

    expect(element.props.href).toBe('/test');

    expect(element.props.className).toBe('link');

    expect(element.props['data-test']).toBe('foo');

    expect(element.props.children).toBe('link');
  });

  it('should handle deeply nested tag structures', () => {
    const declarations = [
      { type: 'div', props: {} },
      { type: 'span', props: {} },
      { type: 'strong', props: {} },
    ];

    const result = renderTranslation('<0><1><2>deep</2></1></0>', declarations);

    expect(result).toHaveLength(1);

    const div = result[0];

    expect(div.type).toBe('div');

    const span = div.props.children;

    expect(span.type).toBe('span');

    const strong = span.props.children;

    expect(strong.type).toBe('strong');

    expect(strong.props.children).toBe('deep');
  });

  it('should handle self-closing and empty tags', () => {
    const declarations = [{ type: 'Icon', props: { name: 'test' } }];

    const result = renderTranslation('Text <0></0> more text', declarations);

    expect(result).toHaveLength(3);

    expect(result[0]).toBe('Text ');

    expect(React.isValidElement(result[1])).toBe(true);

    expect(result[2]).toBe(' more text');

    const icon = result[1];

    expect(icon.type).toBe('Icon');

    expect(icon.props.name).toBe('test');

    expect(icon.props.children).toBeUndefined();
  });

  it('should decode HTML entities in text content', () => {
    const declarations = [{ type: 'strong', props: {} }];

    const result = renderTranslation('<0>me &amp; you &lt; 5</0>', declarations);

    expect(result).toHaveLength(1);

    const element = result[0];

    expect(element.props.children).toBe('me & you < 5');
  });

  it('should decode non-breaking space entities correctly', () => {
    const declarations = [{ type: 'span', props: {} }];

    const result = renderTranslation('<0>hello&nbsp;world</0>', declarations);

    expect(result).toHaveLength(1);

    const element = result[0];

    expect(element.props.children).toBe('hello\u00A0world');
  });

  it('should handle real-world translation with custom styling', () => {
    const declarations = [{ type: 'div', props: { className: 'foo' } }];

    const result = renderTranslation('<0>bonjour</0>', declarations);

    expect(result).toHaveLength(1);

    const element = result[0];

    expect(element.type).toBe('div');

    expect(element.props.className).toBe('foo');

    expect(element.props.children).toBe('bonjour');
  });

  it('should handle real-world documentation link pattern with nested icon', () => {
    const declarations = [
      { type: 'a', props: { href: '#' } },
      { type: 'Icon', props: { name: 'external-link' } },
    ];

    const result = renderTranslation(
      'Voir <0>documentation <1></1></0> pour plus de détails.',
      declarations,
    );

    expect(result).toHaveLength(3);

    expect(result[0]).toBe('Voir ');

    expect(React.isValidElement(result[1])).toBe(true);

    expect(result[2]).toBe(' pour plus de détails.');

    const link = result[1];

    expect(link.type).toBe('a');

    const linkChildren = React.Children.toArray(link.props.children);

    expect(linkChildren).toHaveLength(2);

    expect(linkChildren[0]).toBe('documentation ');

    const icon = linkChildren[1];

    expect(icon.type).toBe('Icon');

    expect(icon.props.name).toBe('external-link');
  });

  it('should handle empty translation strings', () => {
    const result = renderTranslation('');

    expect(result).toEqual([]);
  });

  it('should preserve whitespace-only translations', () => {
    const result = renderTranslation('   ');

    expect(result).toEqual(['   ']);
  });

  it('should throw TranslationParserError for unexpected closing tags', () => {
    expect(() => {
      renderTranslation('Hello </0>', []);
    }).toThrow(TranslationParserError);

    expect(() => {
      renderTranslation('Hello </0>', []);
    }).toThrow('Unexpected closing tag');
  });

  it('should throw TranslationParserError for mismatched opening and closing tags', () => {
    const declarations = [
      { type: 'strong', props: {} },
      { type: 'em', props: {} },
    ];

    expect(() => {
      renderTranslation('<0>text</1>', declarations);
    }).toThrow(TranslationParserError);

    expect(() => {
      renderTranslation('<0>text</1>', declarations);
    }).toThrow('Mismatched tags');
  });

  it('should throw TranslationParserError for unclosed tags', () => {
    const declarations = [{ type: 'strong', props: {} }];

    expect(() => {
      renderTranslation('<0>text', declarations);
    }).toThrow(TranslationParserError);

    expect(() => {
      renderTranslation('<0>text', declarations);
    }).toThrow('Unclosed tag');
  });

  it('should treat tags as literal text when declaration is missing', () => {
    // Changed behavior: instead of throwing, treat missing declarations as literal text
    const result = renderTranslation('<0>text</0>', []);

    // The result will have the tag parts and text as separate array elements
    expect(result).toEqual(['<0>', 'text', '</0>']);
  });

  it('should reuse the same declaration for multiple tags with identical numbers', () => {
    const declarations = [{ type: 'strong', props: {} }];

    const result = renderTranslation('<0>first</0> and <0>second</0>', declarations);

    expect(result).toHaveLength(3);

    expect(React.isValidElement(result[0])).toBe(true);

    expect(result[1]).toBe(' and ');

    expect(React.isValidElement(result[2])).toBe(true);

    const first = result[0];

    expect(first.type).toBe('strong');

    expect(first.props.children).toBe('first');

    const second = result[2];

    expect(second.type).toBe('strong');

    expect(second.props.children).toBe('second');
  });

  it('should pass through ICU variable placeholders without modification', () => {
    const declarations = [{ type: 'strong', props: {} }];

    const result = renderTranslation('<0>{userName}</0>', declarations);

    expect(result).toHaveLength(1);

    const element = result[0];

    expect(element.props.children).toBe('{userName}');
  });

  it('should pass through complex ICU message syntax without modification', () => {
    const declarations = [{ type: 'span', props: {} }];

    const result = renderTranslation(
      '<0>{count, plural, one {# item} other {# items}}</0>',
      declarations,
    );

    expect(result).toHaveLength(1);

    const element = result[0];

    expect(element.props.children).toBe('{count, plural, one {# item} other {# items}}');
  });

  it('should render custom React component types from declarations', () => {
    function CustomButton({ label }) {
      return React.createElement('button', { type: 'button' }, label || 'Click');
    }

    const declarations = [{ type: CustomButton, props: { label: 'Custom' } }];

    const result = renderTranslation('<0>text</0>', declarations);

    expect(result).toHaveLength(1);

    const element = result[0];

    expect(element.type).toBe(CustomButton);

    expect(element.props.label).toBe('Custom');

    expect(element.props.children).toBe('text');
  });

  it('should handle declarations with pre-defined children prop structure', () => {
    const declarations = [
      {
        type: 'div',
        props: {
          className: 'wrapper',
          children: [{ type: 'span', props: { className: 'inner' } }],
        },
      },
    ];

    const result = renderTranslation('<0>text</0>', declarations);

    expect(result).toHaveLength(1);

    const element = result[0];

    expect(element.type).toBe('div');

    expect(element.props.className).toBe('wrapper');

    expect(element.props.children).toBe('text');
  });

  it('should create TranslationParserError instances with all required properties', () => {
    const error = new TranslationParserError('Test error', 10, 'test translation');

    expect(error).toBeInstanceOf(Error);

    expect(error).toBeInstanceOf(TranslationParserError);

    expect(error.name).toBe('TranslationParserError');

    expect(error.message).toBe('Test error');

    expect(error.position).toBe(10);

    expect(error.translationString).toBe('test translation');
  });

  it('should decode numeric HTML entities in both decimal and hexadecimal formats', () => {
    const declarations = [{ type: 'span', props: {} }];

    const result = renderTranslation('<0>&#65; &#x42;</0>', declarations);

    expect(result).toHaveLength(1);

    const element = result[0];

    expect(element.props.children).toBe('A B');
  });

  it('should handle nested declarations containing children arrays for multi-level structures', () => {
    const declarations = [
      {
        type: 'div',
        props: {
          style: { color: 'red' },
          children: [
            { type: 'code' }, // nested child that handles <0> inside parent
          ],
        },
      },
    ];

    const result = renderTranslation(
      'before <0>parent text and <0>nested content</0></0> after',
      declarations,
    );

    expect(result).toHaveLength(3);

    expect(result[0]).toBe('before ');

    expect(result[2]).toBe(' after');

    const parent = result[1];

    expect(parent.type).toBe('div');

    expect(parent.props.style).toEqual({ color: 'red' });

    const parentChildren = React.Children.toArray(parent.props.children);

    expect(parentChildren).toHaveLength(2);

    expect(parentChildren[0]).toBe('parent text and ');

    const nested = parentChildren[1];

    expect(React.isValidElement(nested)).toBe(true);

    expect(nested.type).toBe('code');

    expect(nested.props.children).toBe('nested content');
  });

  it('should handle complex translations with multiple interpolation types and nested structures', () => {
    const declarations = [
      { type: 'strong' },
      { type: 'strong' },
      {
        type: 'div',
        props: {
          style: { color: 'red' },
          children: [{ type: 'code' }],
        },
      },
    ];

    const translation =
      '<0>exciting!</0> hi there <1>friend</1>  and  another nested <2>with regular text and a date: <0>10/11/2025</0></2>';

    const result = renderTranslation(translation, declarations);

    expect(result).toHaveLength(5);

    const exciting = result[0];

    expect(React.isValidElement(exciting)).toBe(true);

    expect(exciting.type).toBe('strong');

    expect(exciting.props.children).toBe('exciting!');

    expect(result[1]).toBe(' hi there ');

    const friend = result[2];

    expect(React.isValidElement(friend)).toBe(true);

    expect(friend.type).toBe('strong');

    expect(friend.props.children).toBe('friend');

    expect(result[3]).toBe('  and  another nested ');

    const boxElement = result[4];

    expect(React.isValidElement(boxElement)).toBe(true);

    expect(boxElement.type).toBe('div');

    expect(boxElement.props.style).toEqual({ color: 'red' });

    const boxChildren = React.Children.toArray(boxElement.props.children);

    expect(boxChildren).toHaveLength(2);

    expect(boxChildren[0]).toBe('with regular text and a date: ');

    const codeElement = boxChildren[1];

    expect(React.isValidElement(codeElement)).toBe(true);

    expect(codeElement.type).toBe('code');

    expect(codeElement.props.children).toBe('10/11/2025');
  });

  it('should handle list elements with nested list item children', () => {
    const declarations = [
      {
        type: 'ul',
        props: {
          children: [{ type: 'li' }, { type: 'li' }],
        },
      },
    ];

    const translation = 'and the fallback <0><0>one</0><1>two</1></0>';

    const result = renderTranslation(translation, declarations);

    expect(result).toHaveLength(2);

    expect(result[0]).toBe('and the fallback ');

    const ul = result[1];

    expect(React.isValidElement(ul)).toBe(true);

    expect(ul.type).toBe('ul');

    const ulChildren = React.Children.toArray(ul.props.children);

    expect(ulChildren).toHaveLength(2);

    const li1 = ulChildren[0];

    expect(React.isValidElement(li1)).toBe(true);

    expect(li1.type).toBe('li');

    expect(li1.props.children).toBe('one');

    const li2 = ulChildren[1];

    expect(React.isValidElement(li2)).toBe(true);

    expect(li2.type).toBe('li');

    expect(li2.props.children).toBe('two');
  });

  it('should handle deeply nested tags interspersed with sibling text content', () => {
    const declarations = [
      { type: 'strong' },
      { type: 'em' },
      {
        type: 'div',
        props: {
          children: [{ type: 'span' }],
        },
      },
    ];

    const translation =
      'Start <0>bold</0> middle <1>italic</1> then <2>container <0>nested span</0></2> end';

    const result = renderTranslation(translation, declarations);

    expect(result).toHaveLength(7);

    expect(result[0]).toBe('Start ');

    const bold = result[1];

    expect(bold.type).toBe('strong');

    expect(bold.props.children).toBe('bold');

    expect(result[2]).toBe(' middle ');

    const italic = result[3];

    expect(italic.type).toBe('em');

    expect(italic.props.children).toBe('italic');

    expect(result[4]).toBe(' then ');

    const div = result[5];

    expect(div.type).toBe('div');

    const divChildren = React.Children.toArray(div.props.children);

    expect(divChildren).toHaveLength(2);

    expect(divChildren[0]).toBe('container ');

    const span = divChildren[1];

    expect(span.type).toBe('span');

    expect(span.props.children).toBe('nested span');

    expect(result[6]).toBe(' end');
  });

  it('should treat literal HTML tags as text, not component placeholders', () => {
    // This tests the case where ICU messageformat might return literal HTML tags
    // These should be rendered as text, not interpreted as component placeholders
    const result = renderTranslation('and the fallback <ul><li>one</li><li>two</li></ul>', []);

    expect(result).toEqual(['and the fallback <ul><li>one</li><li>two</li></ul>']);
  });

  it('should treat numbered tags as literal text when no corresponding declaration exists', () => {
    // This tests the edge case where a translation has numbered tags but no declarations
    // This can happen when using ICU select/plural with literal HTML in some branches
    // The system should gracefully render these as literal text instead of throwing
    const result = renderTranslation('and the fallback <3><0>one</0><1>two</1></3>', []);

    // Each tag and text segment is returned as a separate array element
    expect(result).toEqual([
      'and the fallback ',
      '<3>',
      '<0>',
      'one',
      '</0>',
      '<1>',
      'two',
      '</1>',
      '</3>',
    ]);
  });

  it('should handle literal tags nested inside valid components', () => {
    // This tests the case where a literal tag (missing declaration) appears inside a valid component
    // This covers the stack.length > 0 branch for literal tag handling
    const declarations = [{ type: 'div', props: {} }];

    const result = renderTranslation('<0>Text <1>missing</1> more</0>', declarations);

    expect(result).toHaveLength(1);

    const div = result[0];

    expect(React.isValidElement(div)).toBe(true);

    expect(div.type).toBe('div');

    const divChildren = React.Children.toArray(div.props.children);

    // Should have: 'Text ', '<1>', 'missing', '</1>', ' more'
    expect(divChildren).toHaveLength(5);

    expect(divChildren[0]).toBe('Text ');

    expect(divChildren[1]).toBe('<1>');

    expect(divChildren[2]).toBe('missing');

    expect(divChildren[3]).toBe('</1>');

    expect(divChildren[4]).toBe(' more');
  });

  it('should handle multiple nested literal tags inside valid components', () => {
    // Test multiple literal tags at different nesting levels
    const declarations = [
      { type: 'div', props: {} },
      { type: 'span', props: {} },
    ];

    const result = renderTranslation('<0><1>Valid <2>literal</2></1> text</0>', declarations);

    expect(result).toHaveLength(1);

    const div = result[0];

    expect(div.type).toBe('div');

    const divChildren = React.Children.toArray(div.props.children);

    // Should have a span element and ' text'
    expect(divChildren).toHaveLength(2);

    const span = divChildren[0];

    expect(React.isValidElement(span)).toBe(true);

    expect(span.type).toBe('span');

    const spanChildren = React.Children.toArray(span.props.children);

    // Should have: 'Valid ', '<2>', 'literal', '</2>'
    expect(spanChildren).toHaveLength(4);

    expect(spanChildren[0]).toBe('Valid ');

    expect(spanChildren[1]).toBe('<2>');

    expect(spanChildren[2]).toBe('literal');

    expect(spanChildren[3]).toBe('</2>');

    expect(divChildren[1]).toBe(' text');
  });
});
