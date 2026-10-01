import { describe, it, expect } from 'vitest';
import keysFromSelector from '../../src/selector.js';

describe('keysFromSelector', () => {
  describe('example-based test suite', () => {
    it('handles identity function', () => {
      const keys = keysFromSelector(($) => $);
      expect(keys).toEqual('');
    });

    it('tracks property access with default key separator', () => {
      const keys = keysFromSelector(($) => $.a.b.c);
      expect(keys).toEqual('a.b.c');
    });

    it('works with array indices', () => {
      const keys = keysFromSelector(($) => $[0][1][2]);
      expect(keys).toEqual('0.1.2');
    });

    it('supports custom keySeparator option', () => {
      const keys = keysFromSelector(($) => $[0][1][2], { keySeparator: '...' });
      expect(keys).toEqual('0...1...2');
    });
  });

  describe('namespace resolution', () => {
    it('prepends nsSeparator for a secondary namespace in a multi-ns array', () => {
      // ns1 is primary — its keys are on $ directly.
      // ns2 is secondary — GetSource hangs it under $.ns2, so the path ['ns2','description','part1']
      // must be rewritten to 'ns2:description.part1' for extractFromKey to route correctly.
      const keys = keysFromSelector(($) => $.ns2.description.part1, {
        ns: ['ns1', 'ns2'],
      });
      expect(keys).toEqual('ns2:description.part1');
    });

    it('does NOT prepend nsSeparator when ns is a single string — regression for #2405', () => {
      // When ns is a single string, GetSource returns Resources[ns] directly.
      // $ IS the namespace resource, so $.common.name means key "common.name" inside
      // the active namespace — "common" is NOT a namespace prefix here.
      const keys = keysFromSelector(($) => $.common.name, {
        ns: 'config',
      });
      expect(keys).toEqual('common.name');
    });

    it('does NOT prepend nsSeparator when ns is a single-element array', () => {
      // Same reasoning as single string: $ IS Resources[ns[0]] directly.
      const keys = keysFromSelector(($) => $.common.name, {
        ns: ['config'],
      });
      expect(keys).toEqual('common.name');
    });

    it('does NOT prepend nsSeparator for the primary namespace in a multi-ns array', () => {
      // ns1 is primary — even though it appears in the ns list, its keys are on $ directly.
      // A path starting with 'ns1' means a key literally named 'ns1', not a namespace switch.
      const keys = keysFromSelector(($) => $.ns1.someKey, {
        ns: ['ns1', 'ns2'],
      });
      expect(keys).toEqual('ns1.someKey');
    });

    it('does not prepend nsSeparator when first segment is not in the ns list', () => {
      const keys = keysFromSelector(($) => $.someKey.nested, {
        ns: ['ns1', 'ns2'],
      });
      expect(keys).toEqual('someKey.nested');
    });

    it('does not prepend nsSeparator when no ns option is provided', () => {
      const keys = keysFromSelector(($) => $.ns1.description, {});
      expect(keys).toEqual('ns1.description');
    });

    it('respects a custom nsSeparator for secondary namespaces', () => {
      const keys = keysFromSelector(($) => $.ns2.a.b, {
        ns: ['ns1', 'ns2'],
        nsSeparator: '|',
      });
      expect(keys).toEqual('ns2|a.b');
    });

    it('respects custom keySeparator together with nsSeparator', () => {
      const keys = keysFromSelector(($) => $.ns2.a.b, {
        ns: ['ns1', 'ns2'],
        nsSeparator: '|',
        keySeparator: '/',
      });
      expect(keys).toEqual('ns2|a/b');
    });

    it('does not apply namespace logic when nsSeparator is falsy', () => {
      // nsSeparator: false disables namespace splitting entirely
      const keys = keysFromSelector(($) => $.ns2.a.b, {
        ns: ['ns1', 'ns2'],
        nsSeparator: false,
      });
      expect(keys).toEqual('ns2.a.b');
    });

    it('handles a single-segment path that matches a secondary namespace without mangling it', () => {
      // Only one segment — path.length is not > 1, so leave as-is regardless
      const keys = keysFromSelector(($) => $.ns2, {
        ns: ['ns1', 'ns2'],
      });
      expect(keys).toEqual('ns2');
    });
  });

  describe('strict mode (enableSelector: "strict")', () => {
    // Under strict mode `NsResource` exposes namespaces uniformly (no flattened
    // primary), so `path[0]` is always a namespace identifier when it matches
    // the scope's namespace list — including the primary and the single-ns case.
    it('rewrites a primary-prefixed path in a multi-ns scope', () => {
      const keys = keysFromSelector(($) => $.ns1.login.welcome, {
        ns: ['ns1', 'ns2'],
        enableSelector: 'strict',
      });
      expect(keys).toEqual('ns1:login.welcome');
    });

    it('rewrites a secondary-prefixed path in a multi-ns scope', () => {
      const keys = keysFromSelector(($) => $.ns2.email.required, {
        ns: ['ns1', 'ns2'],
        enableSelector: 'strict',
      });
      expect(keys).toEqual('ns2:email.required');
    });

    it('rewrites when ns is a single string', () => {
      const keys = keysFromSelector(($) => $.only.foo, {
        ns: 'only',
        enableSelector: 'strict',
      });
      expect(keys).toEqual('only:foo');
    });

    it('rewrites when ns is a single-element array', () => {
      const keys = keysFromSelector(($) => $.only.foo, {
        ns: ['only'],
        enableSelector: 'strict',
      });
      expect(keys).toEqual('only:foo');
    });

    it('leaves the path alone when first segment is not in the ns list', () => {
      // Strict mode still requires path[0] to match a namespace; an unrelated
      // leading segment is left flat (caller will get a missing-key for it).
      const keys = keysFromSelector(($) => $.unknown.foo, {
        ns: ['ns1', 'ns2'],
        enableSelector: 'strict',
      });
      expect(keys).toEqual('unknown.foo');
    });

    it('respects custom keySeparator and nsSeparator', () => {
      const keys = keysFromSelector(($) => $.ns1.a.b, {
        ns: ['ns1', 'ns2'],
        enableSelector: 'strict',
        keySeparator: '/',
        nsSeparator: '|',
      });
      expect(keys).toEqual('ns1|a/b');
    });

    it('does not rewrite when nsSeparator is falsy', () => {
      // Same fail-safe as the default mode.
      const keys = keysFromSelector(($) => $.ns1.a, {
        ns: ['ns1', 'ns2'],
        enableSelector: 'strict',
        nsSeparator: false,
      });
      expect(keys).toEqual('ns1.a');
    });
  });
});
