import assert from 'node:assert';
import { describe, test } from 'vitest';
import { fixJson } from './fix-json';

test('should handle empty input', () => {
  assert.strictEqual(fixJson(''), '');
});

describe('literals', () => {
  test('should handle incomplete null', () => {
    assert.strictEqual(fixJson('nul'), 'null');
  });

  test('should handle incomplete true', () => {
    assert.strictEqual(fixJson('t'), 'true');
  });

  test('should handle incomplete false', () => {
    assert.strictEqual(fixJson('fals'), 'false');
  });
});

describe('number', () => {
  test('should handle incomplete numbers', () => {
    assert.strictEqual(fixJson('12.'), '12');
  });

  test('should handle numbers with dot', () => {
    assert.strictEqual(fixJson('12.2'), '12.2');
  });

  test('should handle negative numbers', () => {
    assert.strictEqual(fixJson('-12'), '-12');
  });

  test('should handle incomplete negative numbers', () => {
    assert.strictEqual(fixJson('-'), '');
  });

  test('should handle e-notation numbers', () => {
    assert.strictEqual(fixJson('2.5e'), '2.5');
    assert.strictEqual(fixJson('2.5e-'), '2.5');
    assert.strictEqual(fixJson('2.5e3'), '2.5e3');
    assert.strictEqual(fixJson('-2.5e3'), '-2.5e3');
  });

  test('should handle uppercase e-notation numbers', () => {
    assert.strictEqual(fixJson('2.5E'), '2.5');
    assert.strictEqual(fixJson('2.5E-'), '2.5');
    assert.strictEqual(fixJson('2.5E3'), '2.5E3');
    assert.strictEqual(fixJson('-2.5E3'), '-2.5E3');
  });

  test('should handle incomplete numbers', () => {
    assert.strictEqual(fixJson('12.e'), '12');
    assert.strictEqual(fixJson('12.34e'), '12.34');
    assert.strictEqual(fixJson('5e'), '5');
  });
});

describe('string', () => {
  test('should handle incomplete strings', () => {
    assert.strictEqual(fixJson('"abc'), '"abc"');
  });

  test('should handle escape sequences', () => {
    assert.strictEqual(
      fixJson('"value with \\"quoted\\" text and \\\\ escape'),
      '"value with \\"quoted\\" text and \\\\ escape"',
    );
  });

  test('should handle incomplete escape sequences', () => {
    assert.strictEqual(fixJson('"value with \\'), '"value with "');
  });

  test('should handle incomplete unicode escape sequences', () => {
    assert.strictEqual(fixJson('"\\u'), '""');
    assert.strictEqual(fixJson('"\\u12'), '""');
    assert.strictEqual(fixJson('"text \\u00'), '"text "');
    assert.strictEqual(fixJson('{"a":"\\u12'), '{"a":""}');

    for (const json of [
      fixJson('"\\u'),
      fixJson('"\\u12'),
      fixJson('"text \\u00'),
      fixJson('{"a":"\\u12'),
    ]) {
      assert.doesNotThrow(() => JSON.parse(json));
    }
  });

  test('should handle unicode characters', () => {
    assert.strictEqual(
      fixJson('"value with unicode \u003C"'),
      '"value with unicode \u003C"',
    );
  });
});

describe('array', () => {
  test('should handle incomplete array', () => {
    assert.strictEqual(fixJson('['), '[]');
  });

  test('should handle closing bracket after number in array', () => {
    assert.strictEqual(fixJson('[[1], [2'), '[[1], [2]]');
  });

  test('should handle closing bracket after string in array', () => {
    assert.strictEqual(fixJson(`[["1"], ["2`), `[["1"], ["2"]]`);
  });

  test('should handle closing bracket after literal in array', () => {
    assert.strictEqual(fixJson('[[false], [nu'), '[[false], [null]]');
  });

  test('should handle closing bracket after array in array', () => {
    assert.strictEqual(fixJson('[[[]], [[]'), '[[[]], [[]]]');
  });

  test('should handle closing bracket after object in array', () => {
    assert.strictEqual(fixJson('[[{}], [{'), '[[{}], [{}]]');
  });

  test('should handle trailing comma', () => {
    assert.strictEqual(fixJson('[1, '), '[1]');
  });

  test('should handle closing array', () => {
    assert.strictEqual(fixJson('[[], 123'), '[[], 123]');
  });
});

describe('object', () => {
  test('should handle keys without values', () => {
    assert.strictEqual(fixJson('{"key":'), '{}');
  });

  test('should handle closing brace after number in object', () => {
    assert.strictEqual(
      fixJson('{"a": {"b": 1}, "c": {"d": 2'),
      '{"a": {"b": 1}, "c": {"d": 2}}',
    );
  });

  test('should handle closing brace after string in object', () => {
    assert.strictEqual(
      fixJson('{"a": {"b": "1"}, "c": {"d": 2'),
      '{"a": {"b": "1"}, "c": {"d": 2}}',
    );
  });

  test('should handle closing brace after literal in object', () => {
    assert.strictEqual(
      fixJson('{"a": {"b": false}, "c": {"d": 2'),
      '{"a": {"b": false}, "c": {"d": 2}}',
    );
  });

  test('should handle closing brace after array in object', () => {
    assert.strictEqual(
      fixJson('{"a": {"b": []}, "c": {"d": 2'),
      '{"a": {"b": []}, "c": {"d": 2}}',
    );
  });

  test('should handle closing brace after object in object', () => {
    assert.strictEqual(
      fixJson('{"a": {"b": {}}, "c": {"d": 2'),
      '{"a": {"b": {}}, "c": {"d": 2}}',
    );
  });

  test('should handle partial keys (first key)', () => {
    assert.strictEqual(fixJson('{"ke'), '{}');
  });

  test('should handle partial keys (second key)', () => {
    assert.strictEqual(fixJson('{"k1": 1, "k2'), '{"k1": 1}');
  });

  test('should handle partial keys with colon (second key)', () => {
    assert.strictEqual(fixJson('{"k1": 1, "k2":'), '{"k1": 1}');
  });

  test('should handle trailing whitespace', () => {
    assert.strictEqual(fixJson('{"key": "value"  '), '{"key": "value"}');
  });

  test('should handle closing after empty object', () => {
    assert.strictEqual(fixJson('{"a": {"b": {}'), '{"a": {"b": {}}}');
  });
});

describe('nesting', () => {
  test('should handle nested arrays with numbers', () => {
    assert.strictEqual(fixJson('[1, [2, 3, ['), '[1, [2, 3, []]]');
  });

  test('should handle nested arrays with literals', () => {
    assert.strictEqual(fixJson('[false, [true, ['), '[false, [true, []]]');
  });

  test('should handle nested objects', () => {
    assert.strictEqual(fixJson('{"key": {"subKey":'), '{"key": {}}');
  });

  test('should handle nested objects with numbers', () => {
    assert.strictEqual(
      fixJson('{"key": 123, "key2": {"subKey":'),
      '{"key": 123, "key2": {}}',
    );
  });

  test('should handle nested objects with literals', () => {
    assert.strictEqual(
      fixJson('{"key": null, "key2": {"subKey":'),
      '{"key": null, "key2": {}}',
    );
  });

  test('should handle arrays within objects', () => {
    assert.strictEqual(fixJson('{"key": [1, 2, {'), '{"key": [1, 2, {}]}');
  });

  test('should handle objects within arrays', () => {
    assert.strictEqual(
      fixJson('[1, 2, {"key": "value",'),
      '[1, 2, {"key": "value"}]',
    );
  });

  test('should handle nested arrays and objects', () => {
    assert.strictEqual(
      fixJson('{"a": {"b": ["c", {"d": "e",'),
      '{"a": {"b": ["c", {"d": "e"}]}}',
    );
  });

  test('should handle deeply nested objects', () => {
    assert.strictEqual(
      fixJson('{"a": {"b": {"c": {"d":'),
      '{"a": {"b": {"c": {}}}}',
    );
  });

  test('should handle potential nested arrays or objects', () => {
    assert.strictEqual(fixJson('{"a": 1, "b": ['), '{"a": 1, "b": []}');
    assert.strictEqual(fixJson('{"a": 1, "b": {'), '{"a": 1, "b": {}}');
    assert.strictEqual(fixJson('{"a": 1, "b": "'), '{"a": 1, "b": ""}');
  });
});

describe('regression', () => {
  test('should handle complex nesting 1', () => {
    assert.strictEqual(
      fixJson(
        [
          '{',
          '  "a": [',
          '    {',
          '      "a1": "v1",',
          '      "a2": "v2",',
          `      "a3": "v3"`,
          '    }',
          '  ],',
          '  "b": [',
          '    {',
          '      "b1": "n',
        ].join('\n'),
      ),
      [
        '{',
        '  "a": [',
        '    {',
        '      "a1": "v1",',
        '      "a2": "v2",',
        `      "a3": "v3"`,
        '    }',
        '  ],',
        '  "b": [',
        '    {',
        '      "b1": "n"}]}',
      ].join('\n'),
    );
  });

  test('should handle empty objects inside nested objects and arrays', () => {
    assert.strictEqual(
      fixJson(`{"type":"div","children":[{"type":"Card","props":{}`),
      `{"type":"div","children":[{"type":"Card","props":{}}]}`,
    );
  });
});
