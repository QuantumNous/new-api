// Tests for requestRuleExpr.js — focusing on the gjson double-quoted path round-trip
// introduced in the fix for `param("content.#(type=='video_url')")` never matching.

import { describe, it, expect } from 'vitest';
import {
  buildRequestRuleExpr,
  tryParseRequestRuleExpr,
  SOURCE_PARAM,
  MATCH_EXISTS,
  MATCH_EQ,
  MATCH_CONTAINS,
  MATCH_GTE,
} from './requestRuleExpr.js';

// ---------------------------------------------------------------------------
// Build direction: path field → expr string
// ---------------------------------------------------------------------------

describe('buildRequestRuleExpr — gjson double-quoted path', () => {
  it('emits escaped double quotes for a gjson #() path', () => {
    const groups = [
      {
        conditions: [
          { source: SOURCE_PARAM, path: 'content.#(type=="video_url")', mode: MATCH_EXISTS },
        ],
        multiplier: '0.608696',
      },
    ];
    const expr = buildRequestRuleExpr(groups);
    // JSON.stringify wraps the path in double quotes, escaping the inner ones
    expect(expr).toBe('(param("content.#(type==\\"video_url\\")") != nil ? 0.608696 : 1)');
  });

  it('round-trips a simple path without special chars unchanged', () => {
    const groups = [
      {
        conditions: [{ source: SOURCE_PARAM, path: 'resolution', mode: MATCH_EQ, value: '1080p' }],
        multiplier: '1.108696',
      },
    ];
    const expr = buildRequestRuleExpr(groups);
    expect(expr).toBe('(param("resolution") == "1080p" ? 1.108696 : 1)');
  });
});

// ---------------------------------------------------------------------------
// Reverse direction: expr string → groups (parser)
// ---------------------------------------------------------------------------

describe('tryParseRequestRuleExpr — gjson double-quoted path reverse parsing', () => {
  it('parses MATCH_EXISTS with escaped double-quote path back to the original path', () => {
    // This is what the build direction emits for content.#(type=="video_url")
    const expr = '(param("content.#(type==\\"video_url\\")") != nil ? 0.608696 : 1)';
    const groups = tryParseRequestRuleExpr(expr);
    expect(groups).not.toBeNull();
    expect(groups).toHaveLength(1);
    const cond = groups[0].conditions[0];
    expect(cond.source).toBe(SOURCE_PARAM);
    expect(cond.path).toBe('content.#(type=="video_url")');
    expect(cond.mode).toBe(MATCH_EXISTS);
    expect(groups[0].multiplier).toBe('0.608696');
  });

  it('full round-trip: PRESET_GROUPS path → expr → parse → same path', () => {
    // Simulate what applyPreset does: build from preset, then reverse-parse
    const presetPath = 'content.#(type=="video_url")';
    const groups = [
      { conditions: [{ source: SOURCE_PARAM, path: presetPath, mode: MATCH_EXISTS }], multiplier: '0.594595' },
    ];
    const expr = buildRequestRuleExpr(groups);
    const parsed = tryParseRequestRuleExpr(expr);
    expect(parsed).not.toBeNull();
    expect(parsed[0].conditions[0].path).toBe(presetPath);
    expect(parsed[0].multiplier).toBe('0.594595');
  });

  it('still parses a plain path (no escaping needed)', () => {
    const expr = '(param("resolution") == "1080p" ? 1.108696 : 1)';
    const groups = tryParseRequestRuleExpr(expr);
    expect(groups).not.toBeNull();
    expect(groups[0].conditions[0].path).toBe('resolution');
    expect(groups[0].conditions[0].mode).toBe(MATCH_EQ);
    expect(groups[0].conditions[0].value).toBe('1080p');
  });

  it('round-trips other JSON string escapes in paths', () => {
    const path = 'metadata.line\nname';
    const expr = buildRequestRuleExpr([
      { conditions: [{ source: SOURCE_PARAM, path, mode: MATCH_EXISTS }], multiplier: '0.5' },
    ]);
    const parsed = tryParseRequestRuleExpr(expr);
    expect(parsed).not.toBeNull();
    expect(parsed[0].conditions[0].path).toBe(path);
  });

  it('does not parse an empty path as a valid request rule', () => {
    expect(tryParseRequestRuleExpr('(param("") != nil ? 0.5 : 1)')).toBeNull();
  });

  it('does not throw on invalid JSON escape inside has() value (admin half-typed)', () => {
    // \q is not a valid JSON escape sequence; regex still matches but JSON.parse
    // would throw. Guard ensures the parser returns null gracefully.
    const expr = '(has(header("x-flag"), "\\q") ? 0.5 : 1)';
    expect(() => tryParseRequestRuleExpr(expr)).not.toThrow();
    expect(tryParseRequestRuleExpr(expr)).toBeNull();
  });

  it('does not throw on invalid JSON escape inside param has() value', () => {
    const expr = '(param("foo") != nil && has(param("foo"), "\\q") ? 0.5 : 1)';
    expect(() => tryParseRequestRuleExpr(expr)).not.toThrow();
    expect(tryParseRequestRuleExpr(expr)).toBeNull();
  });


  it('old single-quoted path (the buggy form) does NOT produce a gjson-correct path', () => {
    // The old preset used single quotes — the build direction emits them literally,
    // resulting in an expr that gjson cannot match. Confirm the build output differs
    // from the fixed double-quoted form.
    const buggyGroups = [
      {
        conditions: [
          { source: SOURCE_PARAM, path: "content.#(type=='video_url')", mode: MATCH_EXISTS },
        ],
        multiplier: '0.608696',
      },
    ];
    const buggyExpr = buildRequestRuleExpr(buggyGroups);
    // Single quotes are not special to JSON.stringify, so they pass through unchanged —
    // the gjson filter `#(type=='video_url')` uses invalid syntax and never matches.
    expect(buggyExpr).toContain("type=='video_url'");
    // And it differs from the correct form which uses escaped double-quotes
    expect(buggyExpr).not.toContain('type==\\"video_url\\"');
  });
});

// ---------------------------------------------------------------------------
// Additional coverage: multi-group (seedance 2.0 has two rules)
// ---------------------------------------------------------------------------

describe('tryParseRequestRuleExpr — seedance 2.0 two-rule group', () => {
  it('round-trips the full seedance 2.0 request rules', () => {
    const presetGroups = [
      {
        conditions: [{ source: SOURCE_PARAM, path: 'resolution', mode: MATCH_EQ, value: '1080p' }],
        multiplier: '1.108696',
      },
      {
        conditions: [
          { source: SOURCE_PARAM, path: 'content.#(type=="video_url")', mode: MATCH_EXISTS },
        ],
        multiplier: '0.608696',
      },
    ];
    const expr = buildRequestRuleExpr(presetGroups);
    const parsed = tryParseRequestRuleExpr(expr);
    expect(parsed).not.toBeNull();
    expect(parsed).toHaveLength(2);
    expect(parsed[0].conditions[0].path).toBe('resolution');
    expect(parsed[1].conditions[0].path).toBe('content.#(type=="video_url")');
    expect(parsed[1].conditions[0].mode).toBe(MATCH_EXISTS);
    expect(parsed[1].multiplier).toBe('0.608696');
  });
});
