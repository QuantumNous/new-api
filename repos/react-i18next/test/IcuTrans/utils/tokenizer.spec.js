import { describe, it, expect } from 'vitest';
import { tokenize } from '../../../src/IcuTransUtils';

describe('tokenizer', () => {
  describe('plain text', () => {
    it('should tokenize plain text without any tags', () => {
      const result = tokenize('Hello world');

      expect(result).toEqual([
        {
          type: 'Text',
          value: 'Hello world',
          position: 0,
        },
      ]);
    });

    it('should handle empty strings', () => {
      const result = tokenize('');

      expect(result).toEqual([]);
    });

    it('should preserve whitespace-only text', () => {
      const result = tokenize('   ');

      expect(result).toEqual([
        {
          type: 'Text',
          value: '   ',
          position: 0,
        },
      ]);
    });

    it('should preserve newlines and tabs', () => {
      const result = tokenize('Hello\nWorld\tTest');

      expect(result).toEqual([
        {
          type: 'Text',
          value: 'Hello\nWorld\tTest',
          position: 0,
        },
      ]);
    });
  });

  describe('single tag', () => {
    it('should tokenize a simple opening and closing tag', () => {
      const result = tokenize('<0>text</0>');

      expect(result).toEqual([
        {
          type: 'TagOpen',
          value: '<0>',
          position: 0,
          tagNumber: 0,
        },
        {
          type: 'Text',
          value: 'text',
          position: 3,
        },
        {
          type: 'TagClose',
          value: '</0>',
          position: 7,
          tagNumber: 0,
        },
      ]);
    });

    it('should tokenize tag with single-digit numbers', () => {
      const result = tokenize('<5>content</5>');

      expect(result).toEqual([
        {
          type: 'TagOpen',
          value: '<5>',
          position: 0,
          tagNumber: 5,
        },
        {
          type: 'Text',
          value: 'content',
          position: 3,
        },
        {
          type: 'TagClose',
          value: '</5>',
          position: 10,
          tagNumber: 5,
        },
      ]);
    });

    it('should tokenize tag with multi-digit numbers', () => {
      const result = tokenize('<123>test</123>');

      expect(result).toEqual([
        {
          type: 'TagOpen',
          value: '<123>',
          position: 0,
          tagNumber: 123,
        },
        {
          type: 'Text',
          value: 'test',
          position: 5,
        },
        {
          type: 'TagClose',
          value: '</123>',
          position: 9,
          tagNumber: 123,
        },
      ]);
    });

    it('should handle empty tags', () => {
      const result = tokenize('<0></0>');

      expect(result).toEqual([
        {
          type: 'TagOpen',
          value: '<0>',
          position: 0,
          tagNumber: 0,
        },
        {
          type: 'TagClose',
          value: '</0>',
          position: 3,
          tagNumber: 0,
        },
      ]);
    });
  });

  describe('text with tags', () => {
    it('should tokenize text before a tag', () => {
      const result = tokenize('Hello <0>world</0>');

      expect(result).toEqual([
        {
          type: 'Text',
          value: 'Hello ',
          position: 0,
        },
        {
          type: 'TagOpen',
          value: '<0>',
          position: 6,
          tagNumber: 0,
        },
        {
          type: 'Text',
          value: 'world',
          position: 9,
        },
        {
          type: 'TagClose',
          value: '</0>',
          position: 14,
          tagNumber: 0,
        },
      ]);
    });

    it('should tokenize text after a tag', () => {
      const result = tokenize('<0>Hello</0> world');

      expect(result).toEqual([
        {
          type: 'TagOpen',
          value: '<0>',
          position: 0,
          tagNumber: 0,
        },
        {
          type: 'Text',
          value: 'Hello',
          position: 3,
        },
        {
          type: 'TagClose',
          value: '</0>',
          position: 8,
          tagNumber: 0,
        },
        {
          type: 'Text',
          value: ' world',
          position: 12,
        },
      ]);
    });

    it('should tokenize text before, inside, and after tags', () => {
      const result = tokenize('Start <0>middle</0> end');

      expect(result).toEqual([
        {
          type: 'Text',
          value: 'Start ',
          position: 0,
        },
        {
          type: 'TagOpen',
          value: '<0>',
          position: 6,
          tagNumber: 0,
        },
        {
          type: 'Text',
          value: 'middle',
          position: 9,
        },
        {
          type: 'TagClose',
          value: '</0>',
          position: 15,
          tagNumber: 0,
        },
        {
          type: 'Text',
          value: ' end',
          position: 19,
        },
      ]);
    });
  });

  describe('multiple tags', () => {
    it('should tokenize multiple consecutive tags', () => {
      const result = tokenize('<0>first</0><1>second</1>');

      expect(result).toEqual([
        {
          type: 'TagOpen',
          value: '<0>',
          position: 0,
          tagNumber: 0,
        },
        {
          type: 'Text',
          value: 'first',
          position: 3,
        },
        {
          type: 'TagClose',
          value: '</0>',
          position: 8,
          tagNumber: 0,
        },
        {
          type: 'TagOpen',
          value: '<1>',
          position: 12,
          tagNumber: 1,
        },
        {
          type: 'Text',
          value: 'second',
          position: 15,
        },
        {
          type: 'TagClose',
          value: '</1>',
          position: 21,
          tagNumber: 1,
        },
      ]);
    });

    it('should tokenize multiple tags with text between them', () => {
      const result = tokenize('<0>bold</0> and <1>italic</1>');

      expect(result).toEqual([
        {
          type: 'TagOpen',
          value: '<0>',
          position: 0,
          tagNumber: 0,
        },
        {
          type: 'Text',
          value: 'bold',
          position: 3,
        },
        {
          type: 'TagClose',
          value: '</0>',
          position: 7,
          tagNumber: 0,
        },
        {
          type: 'Text',
          value: ' and ',
          position: 11,
        },
        {
          type: 'TagOpen',
          value: '<1>',
          position: 16,
          tagNumber: 1,
        },
        {
          type: 'Text',
          value: 'italic',
          position: 19,
        },
        {
          type: 'TagClose',
          value: '</1>',
          position: 25,
          tagNumber: 1,
        },
      ]);
    });

    it('should handle the same tag number used multiple times', () => {
      const result = tokenize('<0>first</0> and <0>second</0>');

      expect(result).toEqual([
        {
          type: 'TagOpen',
          value: '<0>',
          position: 0,
          tagNumber: 0,
        },
        {
          type: 'Text',
          value: 'first',
          position: 3,
        },
        {
          type: 'TagClose',
          value: '</0>',
          position: 8,
          tagNumber: 0,
        },
        {
          type: 'Text',
          value: ' and ',
          position: 12,
        },
        {
          type: 'TagOpen',
          value: '<0>',
          position: 17,
          tagNumber: 0,
        },
        {
          type: 'Text',
          value: 'second',
          position: 20,
        },
        {
          type: 'TagClose',
          value: '</0>',
          position: 26,
          tagNumber: 0,
        },
      ]);
    });
  });

  describe('nested tags', () => {
    it('should tokenize nested tags', () => {
      const result = tokenize('<0>outer <1>inner</1> text</0>');

      expect(result).toEqual([
        {
          type: 'TagOpen',
          value: '<0>',
          position: 0,
          tagNumber: 0,
        },
        {
          type: 'Text',
          value: 'outer ',
          position: 3,
        },
        {
          type: 'TagOpen',
          value: '<1>',
          position: 9,
          tagNumber: 1,
        },
        {
          type: 'Text',
          value: 'inner',
          position: 12,
        },
        {
          type: 'TagClose',
          value: '</1>',
          position: 17,
          tagNumber: 1,
        },
        {
          type: 'Text',
          value: ' text',
          position: 21,
        },
        {
          type: 'TagClose',
          value: '</0>',
          position: 26,
          tagNumber: 0,
        },
      ]);
    });

    it('should tokenize deeply nested tags', () => {
      const result = tokenize('<0><1><2>deep</2></1></0>');

      expect(result).toEqual([
        {
          type: 'TagOpen',
          value: '<0>',
          position: 0,
          tagNumber: 0,
        },
        {
          type: 'TagOpen',
          value: '<1>',
          position: 3,
          tagNumber: 1,
        },
        {
          type: 'TagOpen',
          value: '<2>',
          position: 6,
          tagNumber: 2,
        },
        {
          type: 'Text',
          value: 'deep',
          position: 9,
        },
        {
          type: 'TagClose',
          value: '</2>',
          position: 13,
          tagNumber: 2,
        },
        {
          type: 'TagClose',
          value: '</1>',
          position: 17,
          tagNumber: 1,
        },
        {
          type: 'TagClose',
          value: '</0>',
          position: 21,
          tagNumber: 0,
        },
      ]);
    });
  });

  describe('non-tag angle brackets', () => {
    it('should treat < as text when not followed by digits', () => {
      const result = tokenize('5 < 10');

      expect(result).toEqual([
        {
          type: 'Text',
          value: '5 < 10',
          position: 0,
        },
      ]);
    });

    it('should treat </ as text when not followed by digits and >', () => {
      const result = tokenize('a </div>');

      expect(result).toEqual([
        {
          type: 'Text',
          value: 'a </div>',
          position: 0,
        },
      ]);
    });

    it('should treat incomplete tags as text', () => {
      const result = tokenize('<0 not a tag');

      expect(result).toEqual([
        {
          type: 'Text',
          value: '<0 not a tag',
          position: 0,
        },
      ]);
    });

    it("should handle text with < and > that aren't tags", () => {
      const result = tokenize('x < y && z > w');

      expect(result).toEqual([
        {
          type: 'Text',
          value: 'x < y && z > w',
          position: 0,
        },
      ]);
    });

    it('should handle mixed valid tags and non-tag brackets', () => {
      const result = tokenize('<0>5 < 10</0>');

      expect(result).toEqual([
        {
          type: 'TagOpen',
          value: '<0>',
          position: 0,
          tagNumber: 0,
        },
        {
          type: 'Text',
          value: '5 < 10',
          position: 3,
        },
        {
          type: 'TagClose',
          value: '</0>',
          position: 9,
          tagNumber: 0,
        },
      ]);
    });
  });

  describe('ICU variable placeholders', () => {
    it('should treat ICU variables as text', () => {
      const result = tokenize('{userName}');

      expect(result).toEqual([
        {
          type: 'Text',
          value: '{userName}',
          position: 0,
        },
      ]);
    });

    it('should handle tags with ICU variables', () => {
      const result = tokenize('<0>Hello {userName}</0>');

      expect(result).toEqual([
        {
          type: 'TagOpen',
          value: '<0>',
          position: 0,
          tagNumber: 0,
        },
        {
          type: 'Text',
          value: 'Hello {userName}',
          position: 3,
        },
        {
          type: 'TagClose',
          value: '</0>',
          position: 19,
          tagNumber: 0,
        },
      ]);
    });

    it('should handle complex ICU plurals', () => {
      const result = tokenize('<0>{count, plural, one {# item} other {# items}}</0>');

      expect(result).toEqual([
        {
          type: 'TagOpen',
          value: '<0>',
          position: 0,
          tagNumber: 0,
        },
        {
          type: 'Text',
          value: '{count, plural, one {# item} other {# items}}',
          position: 3,
        },
        {
          type: 'TagClose',
          value: '</0>',
          position: 48,
          tagNumber: 0,
        },
      ]);
    });
  });

  describe('position tracking', () => {
    it('should track positions correctly for single tag', () => {
      const result = tokenize('<0>test</0>');

      expect(result[0].position).toBe(0); // <0>

      expect(result[1].position).toBe(3); // test

      expect(result[2].position).toBe(7); // </0>
    });

    it('should track positions correctly with leading text', () => {
      const result = tokenize('Hello <0>world</0>');

      expect(result[0].position).toBe(0); // Hello

      expect(result[1].position).toBe(6); // <0>

      expect(result[2].position).toBe(9); // world

      expect(result[3].position).toBe(14); // </0>
    });

    it('should track positions correctly for nested tags', () => {
      const result = tokenize('<0>a <1>b</1> c</0>');

      expect(result[0].position).toBe(0); // <0>

      expect(result[1].position).toBe(3); // a

      expect(result[2].position).toBe(5); // <1>

      expect(result[3].position).toBe(8); // b

      expect(result[4].position).toBe(9); // </1>

      expect(result[5].position).toBe(13); // c

      expect(result[6].position).toBe(15); // </0>
    });

    it('should track positions correctly with multi-digit tag numbers', () => {
      const result = tokenize('<123>test</123>');

      expect(result[0].position).toBe(0); // <123>

      expect(result[1].position).toBe(5); // test

      expect(result[2].position).toBe(9); // </123>
    });
  });

  describe('edge cases', () => {
    it('should handle tag at the very end of string', () => {
      const result = tokenize('text <0>end</0>');

      expect(result).toHaveLength(4);

      expect(result[3].type).toBe('TagClose');
    });

    it('should handle tag at the very beginning of string', () => {
      const result = tokenize('<0>start</0> text');

      expect(result).toHaveLength(4);

      expect(result[0].type).toBe('TagOpen');
    });

    it('should handle only opening tags (no validation)', () => {
      // Note: tokenizer doesn't validate matching, just tokenizes
      const result = tokenize('<0>text');

      expect(result).toEqual([
        {
          type: 'TagOpen',
          value: '<0>',
          position: 0,
          tagNumber: 0,
        },
        {
          type: 'Text',
          value: 'text',
          position: 3,
        },
      ]);
    });

    it('should handle only closing tags (no validation)', () => {
      // Note: tokenizer doesn't validate matching, just tokenizes
      const result = tokenize('text</0>');

      expect(result).toEqual([
        {
          type: 'Text',
          value: 'text',
          position: 0,
        },
        {
          type: 'TagClose',
          value: '</0>',
          position: 4,
          tagNumber: 0,
        },
      ]);
    });

    it('should handle mismatched tag numbers (no validation)', () => {
      // Note: tokenizer doesn't validate matching, just tokenizes
      const result = tokenize('<0>text</1>');

      expect(result).toEqual([
        {
          type: 'TagOpen',
          value: '<0>',
          position: 0,
          tagNumber: 0,
        },
        {
          type: 'Text',
          value: 'text',
          position: 3,
        },
        {
          type: 'TagClose',
          value: '</1>',
          position: 7,
          tagNumber: 1,
        },
      ]);
    });

    it('should handle special characters inside tags', () => {
      const result = tokenize('<0>Hello & goodbye \'quotes\' "double"</0>');

      expect(result).toEqual([
        {
          type: 'TagOpen',
          value: '<0>',
          position: 0,
          tagNumber: 0,
        },
        {
          type: 'Text',
          value: 'Hello & goodbye \'quotes\' "double"',
          position: 3,
        },
        {
          type: 'TagClose',
          value: '</0>',
          position: 36,
          tagNumber: 0,
        },
      ]);
    });

    it('should handle Unicode characters', () => {
      const result = tokenize('<0>Hello 世界 🌍</0>');

      expect(result).toEqual([
        {
          type: 'TagOpen',
          value: '<0>',
          position: 0,
          tagNumber: 0,
        },
        {
          type: 'Text',
          value: 'Hello 世界 🌍',
          position: 3,
        },
        {
          type: 'TagClose',
          value: '</0>',
          position: 14, // Emoji counts as 2 characters in JavaScript
          tagNumber: 0,
        },
      ]);
    });
  });

  describe('real-world examples', () => {
    it('should tokenize a link with an icon', () => {
      const result = tokenize('See <0>documentation <1></1></0> for details.');

      expect(result).toHaveLength(7);

      expect(result[0].type).toBe('Text');

      expect(result[0].value).toBe('See ');

      expect(result[1].type).toBe('TagOpen');

      expect(result[1].tagNumber).toBe(0);

      expect(result[2].type).toBe('Text');

      expect(result[2].value).toBe('documentation ');

      expect(result[3].type).toBe('TagOpen');

      expect(result[3].tagNumber).toBe(1);

      expect(result[4].type).toBe('TagClose');

      expect(result[4].tagNumber).toBe(1);

      expect(result[5].type).toBe('TagClose');

      expect(result[5].tagNumber).toBe(0);

      expect(result[6].type).toBe('Text');

      expect(result[6].value).toBe(' for details.');
    });

    it('should tokenize a complex sentence with multiple styled parts', () => {
      const result = tokenize(
        'Click <0>here</0> to view your <1>account settings</1> or <2>log out</2>.',
      );

      const tagOpenTokens = result.filter((t) => t.type === 'TagOpen');
      const tagCloseTokens = result.filter((t) => t.type === 'TagClose');
      const textTokens = result.filter((t) => t.type === 'Text');

      expect(tagOpenTokens).toHaveLength(3);

      expect(tagCloseTokens).toHaveLength(3);

      expect(textTokens).toHaveLength(7); // Text between and inside tags

      // Verify tag numbers are correct
      expect(tagOpenTokens[0].tagNumber).toBe(0);

      expect(tagOpenTokens[1].tagNumber).toBe(1);

      expect(tagOpenTokens[2].tagNumber).toBe(2);
    });

    it('should tokenize nested list structure', () => {
      const result = tokenize('<0><0>First item</0><1>Second item</1></0>');

      expect(result[0]).toMatchObject({
        type: 'TagOpen',
        tagNumber: 0,
      });

      expect(result[1]).toMatchObject({
        type: 'TagOpen',
        tagNumber: 0,
      });

      expect(result[2]).toMatchObject({
        type: 'Text',
        value: 'First item',
      });

      expect(result[3]).toMatchObject({
        type: 'TagClose',
        tagNumber: 0,
      });

      expect(result[4]).toMatchObject({
        type: 'TagOpen',
        tagNumber: 1,
      });

      expect(result[5]).toMatchObject({
        type: 'Text',
        value: 'Second item',
      });

      expect(result[6]).toMatchObject({
        type: 'TagClose',
        tagNumber: 1,
      });

      expect(result[7]).toMatchObject({
        type: 'TagClose',
        tagNumber: 0,
      });
    });
  });

  describe('type safety', () => {
    it('should return tokens with correct types', () => {
      const result = tokenize('<0>test</0>');

      expect(result[0].type).toBe('TagOpen');

      expect(result[1].type).toBe('Text');

      expect(result[2].type).toBe('TagClose');
    });

    it('should include tagNumber only for tag tokens', () => {
      const result = tokenize('<0>test</0>');

      expect(result[0].tagNumber).toBeDefined();

      expect(result[1].tagNumber).toBeUndefined();

      expect(result[2].tagNumber).toBeDefined();
    });

    it('should always include position for all tokens', () => {
      const result = tokenize('<0>test</0>');

      result.forEach((token) => {
        expect(token.position).toBeDefined();

        expect(typeof token.position).toBe('number');
      });
    });
  });
});
