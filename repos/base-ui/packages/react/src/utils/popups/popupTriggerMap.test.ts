import { describe, expect, it } from 'vitest';
import { isJSDOM } from '#test-utils';
import { PopupTriggerMap } from './popupTriggerMap';

describe('PopupTriggerMap', () => {
  it('adds and retrieves elements by id', () => {
    const map = new PopupTriggerMap();
    const button = document.createElement('button');

    map.add('trigger', button);

    expect(map.getById('trigger')).toBe(button);
    expect(map.hasElement(button)).toBe(true);
    expect(map.hasMatchingElement((el) => el === button)).toBe(true);
    expect(map.size).toBe(1);
  });

  it('replaces an existing element when the id is reused', () => {
    const map = new PopupTriggerMap();
    const first = document.createElement('button');
    const second = document.createElement('button');

    map.add('trigger', first);
    map.add('trigger', second);

    expect(map.getById('trigger')).toBe(second);
    expect(map.hasElement(first)).toBe(false);
    expect(map.hasElement(second)).toBe(true);
    expect(map.size).toBe(1);
  });

  it('deletes elements by id', () => {
    const map = new PopupTriggerMap();
    const button = document.createElement('button');

    map.add('trigger', button);
    map.delete('trigger');

    expect(map.getById('trigger')).toBeUndefined();
    expect(map.hasElement(button)).toBe(false);
    expect(map.hasMatchingElement((el) => el === button)).toBe(false);
    expect(map.size).toBe(0);
  });

  it('does not duplicate when the same element is added twice with the same id', () => {
    const map = new PopupTriggerMap();
    const button = document.createElement('button');

    map.add('trigger', button);
    map.add('trigger', button);

    expect(map.getById('trigger')).toBe(button);
    expect(map.size).toBe(1);
  });

  it('throws in non-production when the same element is registered under multiple ids', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const map = new PopupTriggerMap();
    const button = document.createElement('button');

    try {
      map.add('first', button);
      expect(() => map.add('second', button)).toThrow(
        'Base UI: A trigger element cannot be registered under multiple IDs in PopupTriggerMap.',
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it.skipIf(!isJSDOM)(
    'does not throw in production when the same element is registered under multiple ids',
    () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const map = new PopupTriggerMap();
      const button = document.createElement('button');

      try {
        map.add('first', button);
        expect(() => map.add('second', button)).not.toThrow();
        expect(map.getById('first')).toBe(button);
        expect(map.getById('second')).toBe(button);
        expect(map.hasElement(button)).toBe(true);
        expect(map.size).toBe(2);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    },
  );
});
