import { describe, expect, it } from 'vitest';
import { createIdMap } from './create-id-map';

type TextPart = {
  text: string;
};

type ObjectPrototypeState = {
  text?: unknown;
};

function clearObjectPrototypeState() {
  delete (Object.prototype as ObjectPrototypeState).text;
}

describe('createIdMap', () => {
  it('should create a null-prototype map', () => {
    const map = createIdMap<string>();

    expect(Object.getPrototypeOf(map)).toBeNull();
  });

  it('should store object prototype property names as own keys', () => {
    const map = createIdMap<string>();
    const protoKey: string = '__proto__';
    const constructorKey: string = 'constructor';
    const prototypeKey: string = 'prototype';

    map[protoKey] = 'proto value';
    map[constructorKey] = 'constructor value';
    map[prototypeKey] = 'prototype value';

    expect(map[protoKey]).toBe('proto value');
    expect(map[constructorKey]).toBe('constructor value');
    expect(map[prototypeKey]).toBe('prototype value');
    expect(Object.keys(map)).toEqual(['__proto__', 'constructor', 'prototype']);
  });

  it('should prevent prototype pollution from missing __proto__ lookups', () => {
    clearObjectPrototypeState();
    // Use an indirect key to avoid the deprecated literal __proto__ access diagnostic.
    const protoKey: string = '__proto__';

    try {
      const plainObjectMap: Record<string, TextPart> = {};
      const unsafeTextPart = plainObjectMap[protoKey];

      expect(unsafeTextPart).toBe(Object.prototype);

      unsafeTextPart.text = 'polluted';

      expect(({} as ObjectPrototypeState).text).toBe('polluted');
    } finally {
      clearObjectPrototypeState();
    }

    const idMap = createIdMap<TextPart>();
    const missingTextPart = idMap[protoKey];

    expect(missingTextPart).toBeUndefined();
    expect(Object.hasOwn(Object.prototype, 'text')).toBe(false);
  });
});
