import { InvalidArgumentError } from '@ai-sdk/provider';
import { describe, expect, it } from 'vitest';
import { createIdGenerator, generateId } from './generate-id';

describe('createIdGenerator', () => {
  it('should generate an ID with the correct length', () => {
    const idGenerator = createIdGenerator({ size: 10 });
    expect(idGenerator()).toHaveLength(10);
  });

  it('should generate an ID with the correct default length', () => {
    const idGenerator = createIdGenerator();
    expect(idGenerator()).toHaveLength(16);
  });

  it('should throw an error if the separator is part of the alphabet', () => {
    expect(() => createIdGenerator({ separator: 'a', prefix: 'b' })).toThrow(
      InvalidArgumentError,
    );
  });
});

describe('generateId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();

    expect(id1).not.toBe(id2);
  });
});
