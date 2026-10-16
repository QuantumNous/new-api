import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as testUtils from './test-utils';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
}));

describe('test-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('applyTransform', () => {
    it('should apply transform and return modified source when transform returns string', () => {
      const mockTransform = vi.fn().mockReturnValue('modified source');
      const input = 'original source';

      const result = testUtils.applyTransform(mockTransform, input);

      expect(result).toBe('modified source');
      expect(mockTransform).toHaveBeenCalledWith(
        expect.objectContaining({
          path: 'test.tsx',
          source: input,
        }),
        expect.objectContaining({
          j: expect.any(Function),
          jscodeshift: expect.any(Function),
          stats: expect.any(Function),
          report: console.log,
        }),
        expect.any(Object), // Expecting the 'options' argument
      );
    });

    it('should return original source when transform returns null', () => {
      const mockTransform = vi.fn().mockReturnValue(null);
      const input = 'original source';

      const result = testUtils.applyTransform(mockTransform, input);

      expect(result).toBe(input);
      expect(mockTransform).toHaveBeenCalledWith(
        expect.objectContaining({
          path: 'test.tsx',
          source: input,
        }),
        expect.objectContaining({
          j: expect.any(Function),
          jscodeshift: expect.any(Function),
          stats: expect.any(Function),
          report: console.log,
        }),
        expect.any(Object), // Expecting the 'options' argument
      );
    });

    it('should pass additional options to transform', () => {
      const mockTransform = vi.fn().mockReturnValue('modified');
      const options = { dry: true };

      testUtils.applyTransform(mockTransform, 'input', options);

      expect(mockTransform).toHaveBeenCalledWith(
        expect.objectContaining({
          path: 'test.tsx',
          source: 'input',
        }),
        expect.objectContaining({
          j: expect.any(Function),
          jscodeshift: expect.any(Function),
          stats: expect.any(Function),
          report: console.log,
        }),
        expect.objectContaining(options), // Verifying the 'options' argument
      );
    });
  });

  describe('readFixture', () => {
    const mockExistsSync = existsSync as unknown as ReturnType<typeof vi.fn>;
    const mockReadFileSync = readFileSync as unknown as ReturnType<
      typeof vi.fn
    >;
    const mockJoin = join as unknown as ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockJoin.mockImplementation((...parts) => parts.join('/'));
    });

    it('should read .ts fixture when it exists', () => {
      mockExistsSync.mockImplementation((path: string) => path.endsWith('.ts'));
      mockReadFileSync.mockReturnValue('ts content');

      const result = testUtils.readFixture('test', 'input');

      expect(result).toEqual({
        content: 'ts content',
        extension: '.ts',
      });
      expect(mockReadFileSync).toHaveBeenCalledWith(
        expect.stringContaining('test.input.ts'),
        'utf8',
      );
    });

    it('should read .tsx fixture when .ts does not exist', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path.endsWith('.tsx'),
      );
      mockReadFileSync.mockReturnValue('tsx content');

      const result = testUtils.readFixture('test', 'input');

      expect(result).toEqual({
        content: 'tsx content',
        extension: '.tsx',
      });
      expect(mockReadFileSync).toHaveBeenCalledWith(
        expect.stringContaining('test.input.tsx'),
        'utf8',
      );
    });

    it('should throw error when no fixture exists', () => {
      mockExistsSync.mockReturnValue(false);

      expect(() => testUtils.readFixture('test', 'input')).toThrow(
        'Fixture not found: test.input',
      );
    });
  });

  describe('validateSyntax', () => {
    it('should validate typescript syntax', () => {
      const tsCode = `
        interface User {
          name: string;
          age: number;
        }
        const user: User = {
          name: 'John',
          age: 30
        };
      `;

      expect(() => testUtils.validateSyntax(tsCode, '.ts')).not.toThrow();
    });

    it('should validate tsx syntax', () => {
      const tsxCode = `
        interface Props {
          name: string;
        }
        const Component = ({ name }: Props) => <div>{name}</div>;
      `;

      expect(() => testUtils.validateSyntax(tsxCode, '.tsx')).not.toThrow();
    });

    it('should validate javascript syntax', () => {
      const jsCode = `
        const user = {
          name: 'John',
          age: 30
        };
        console.log(user);
      `;

      expect(() => testUtils.validateSyntax(jsCode, '.js')).not.toThrow();
    });

    it('should validate jsx syntax', () => {
      const jsxCode = `
        const Component = ({ name }) => <div>{name}</div>;
        export default Component;
      `;

      expect(() => testUtils.validateSyntax(jsxCode, '.jsx')).not.toThrow();
    });

    it('should catch syntax errors', () => {
      const invalidCode = `
        const x = {
          foo: 'bar'
          bar: 'baz'  // missing comma
        };
      `;

      expect(() => testUtils.validateSyntax(invalidCode, '.js')).toThrow(
        /Syntax error/,
      );
    });
  });

  describe('testTransform', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should compare transform output with fixture and validate syntax', () => {
      const mockTransform = vi.fn().mockReturnValue('const x: number = 42;');

      (existsSync as any).mockImplementation((path: string) =>
        path.endsWith('.ts'),
      );
      (readFileSync as any)
        .mockReturnValueOnce('const x: number = 1;') // Valid TS input
        .mockReturnValueOnce('const x: number = 42;'); // Valid TS output

      testUtils.testTransform(mockTransform, 'test');

      expect(mockTransform).toHaveBeenCalled();
      expect(readFileSync).toHaveBeenCalledTimes(2);
    });

    it('should throw when transform output does not match fixture', () => {
      const mockTransform = vi.fn().mockReturnValue('wrong output');

      (existsSync as any).mockImplementation((path: string) =>
        path.endsWith('.ts'),
      );
      (readFileSync as any)
        .mockReturnValueOnce('input')
        .mockReturnValueOnce('expected output');

      expect(() => testUtils.testTransform(mockTransform, 'test')).toThrow();
    });
  });
});
