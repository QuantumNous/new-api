import { describe, it, expect } from 'vitest';
import React from 'react';
import { nodesToString } from '../src/Trans';

describe('trans nodeToString', () => {
  describe('treat like other components (legacy)', () => {
    it('should handle voidElements eg. br', () => {
      const fragment = (
        <>
          lorem <br /> ipsum
        </>
      );
      const expected = 'lorem <1></1> ipsum';
      const transKeepBasicHtmlNodesFor = [];
      const actual = nodesToString(fragment.props.children, { transKeepBasicHtmlNodesFor });
      expect(actual).toEqual(expected);
    });

    it('should handle non voidElements eg. strong not having attributes and only one child typeof string', () => {
      const fragment = (
        <>
          lorem <strong>bold</strong> ipsum
        </>
      );
      const expected = 'lorem <1>bold</1> ipsum';
      const transKeepBasicHtmlNodesFor = [];
      const actual = nodesToString(fragment.props.children, { transKeepBasicHtmlNodesFor });
      expect(actual).toEqual(expected);
    });
  });

  describe('treat simplified if simple components', () => {
    it('should handle voidElements eg. br', () => {
      const fragment = (
        <>
          lorem <br /> ipsum
        </>
      );
      const expected = 'lorem <br/> ipsum';
      const transKeepBasicHtmlNodesFor = ['br', 'strong', 'i'];
      const actual = nodesToString(fragment.props.children, {
        transSupportBasicHtmlNodes: true,
        transKeepBasicHtmlNodesFor,
      });
      expect(actual).toEqual(expected);
    });

    it('should handle non voidElements eg. strong not having attributes and only one child typeof string', () => {
      const fragment = (
        <>
          lorem <strong>bold</strong> ipsum
        </>
      );
      const expected = 'lorem <strong>bold</strong> ipsum';
      const transKeepBasicHtmlNodesFor = ['br', 'strong', 'i'];
      const actual = nodesToString(fragment.props.children, {
        transSupportBasicHtmlNodes: true,
        transKeepBasicHtmlNodesFor,
      });
      expect(actual).toEqual(expected);
    });

    it('should handle non voidElements with interpolation children', () => {
      const fragment = (
        <>
          lorem <strong>{{ insert: 'x' }}</strong> ipsum
        </>
      );
      const expected = 'lorem <strong>{{insert}}</strong> ipsum';
      const transKeepBasicHtmlNodesFor = ['br', 'strong', 'i'];
      const actual = nodesToString(fragment.props.children, {
        transSupportBasicHtmlNodes: true,
        transKeepBasicHtmlNodesFor,
      });
      expect(actual).toEqual(expected);
    });

    it('should handle non voidElements with mixed text and interpolation children', () => {
      const fragment = (
        <>
          lorem <strong>Level {{ level: 5 }}</strong> ipsum
        </>
      );
      const expected = 'lorem <strong>Level {{level}}</strong> ipsum';
      const transKeepBasicHtmlNodesFor = ['br', 'strong', 'i'];
      const actual = nodesToString(fragment.props.children, {
        transSupportBasicHtmlNodes: true,
        transKeepBasicHtmlNodesFor,
      });
      expect(actual).toEqual(expected);
    });
  });

  describe('treat like other components if not simple (legacy)', () => {
    it('should handle voidElements eg. br', () => {
      const fragment = (
        <>
          lorem <i className="icon-gear" /> ipsum
        </>
      );
      const expected = 'lorem <1></1> ipsum';
      const transKeepBasicHtmlNodesFor = ['br', 'strong', 'i'];
      const actual = nodesToString(fragment.props.children, {
        transSupportBasicHtmlNodes: true,
        transKeepBasicHtmlNodesFor,
      });
      expect(actual).toEqual(expected);
    });

    it('should handle non voidElements eg. strong not having attributes and only one child typeof string', () => {
      const fragment = (
        <>
          lorem <strong className="special">bold</strong> ipsum
        </>
      );
      const expected = 'lorem <1>bold</1> ipsum';
      const transKeepBasicHtmlNodesFor = ['br', 'strong', 'i'];
      const actual = nodesToString(fragment.props.children, {
        transSupportBasicHtmlNodes: true,
        transKeepBasicHtmlNodesFor,
      });
      expect(actual).toEqual(expected);
    });

    it('should keep the tag name when a keep-tag wraps a non-keep React element (#1919)', () => {
      const fragment = (
        <p>
          You can <a href="http://example.com">click here</a>.
        </p>
      );
      // <p> is in keepArray and `<a>` is not, so the inner element is referenced
      // by index. The renderer scopes the index lookup against the kept <p>'s
      // own children so this round-trips correctly. Matches the form expected
      // by i18next-cli's extractor.
      const expected = '<p>You can <1>click here</1>.</p>';
      const transKeepBasicHtmlNodesFor = ['br', 'strong', 'i', 'p'];
      const actual = nodesToString([fragment], {
        transSupportBasicHtmlNodes: true,
        transKeepBasicHtmlNodesFor,
      });
      expect(actual).toEqual(expected);
    });
  });

  describe('having dynamic list maps', () => {
    it('should create normal inner children if not set to ignore them', () => {
      const fragment = (
        <>
          {'lorem ' /* eslint-disable-line react/jsx-curly-brace-presence */}
          <ul>
            <li>a</li>
            <li>b</li>
          </ul>
          {' ipsum' /* eslint-disable-line react/jsx-curly-brace-presence */}
        </>
      );
      const expected = 'lorem <1><0>a</0><1>b</1></1> ipsum';
      const actual = nodesToString(fragment.props.children, {});
      expect(actual).toEqual(expected);
    });

    it('should omit inner children if set', () => {
      const fragment = (
        <>
          {'lorem ' /* eslint-disable-line react/jsx-curly-brace-presence */}
          <ul i18nIsDynamicList>
            <li>a</li>
            <li>b</li>
          </ul>
          {' ipsum' /* eslint-disable-line react/jsx-curly-brace-presence */}
        </>
      );
      const expected = 'lorem <1></1> ipsum';
      const actual = nodesToString(fragment.props.children, {});
      expect(actual).toEqual(expected);
    });
  });

  describe('interpolation objects and invalid children', () => {
    it('should convert single-key object children to interpolation syntax', () => {
      const fragment = (
        <>
          {'lorem '}
          {{ insert: 'x' }}
          {' ipsum'}
        </>
      );

      const expected = 'lorem {{insert}} ipsum';
      const actual = nodesToString(fragment.props.children, {});
      expect(actual).toEqual(expected);
    });

    it('should support format on interpolation object children', () => {
      const fragment = (
        <>
          {'lorem '}
          {{ insert: 'x', format: 'uppercase' }}
          {' ipsum'}
        </>
      );

      const expected = 'lorem {{insert, uppercase}} ipsum';
      const actual = nodesToString(fragment.props.children, {});
      expect(actual).toEqual(expected);
    });

    it('should ignore invalid primitive children (e.g. numbers)', () => {
      const fragment = (
        <>
          {'lorem '}
          {1}
          {' ipsum'}
        </>
      );

      const expected = 'lorem  ipsum';
      const actual = nodesToString(fragment.props.children, {});
      expect(actual).toEqual(expected);
    });
  });
});
