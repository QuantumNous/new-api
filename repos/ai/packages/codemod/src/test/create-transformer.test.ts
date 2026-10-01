import {
  createTransformer,
  type TransformContext,
} from '../codemods/lib/create-transformer';
import type { FileInfo, API, JSCodeshift } from 'jscodeshift';
import { describe, test, expect, beforeEach, vi } from 'vitest';

describe('createTransformer', () => {
  let mockApi: API;
  let mockFileInfo: FileInfo;
  let mockOptions: any;
  let mockReport: ReturnType<typeof vi.fn>;
  let jscodeshift: JSCodeshift;

  beforeEach(() => {
    // Mock the api object
    mockReport = vi.fn();
    jscodeshift = require('jscodeshift');

    mockApi = {
      jscodeshift,
      j: jscodeshift,
      stats: () => {},
      report: mockReport,
    } as unknown as API;

    // Mock the fileInfo object
    mockFileInfo = {
      path: 'test-file.js',
      source: `
        const a = 1;
        console.log(a);
      `,
    };

    // Mock options if needed
    mockOptions = {};
  });

  test('should return transformed code when changes are made', () => {
    // Create a transformer function that makes changes
    const transformFn = vi.fn(
      (fileInfo, api, options, context: TransformContext) => {
        const { j, root } = context;

        // Replace all console.log statements with console.error
        root
          .find(j.CallExpression, {
            callee: {
              object: { name: 'console' },
              property: { name: 'log' },
            },
          })
          .forEach(path => {
            context.hasChanges = true;
            j(path).replaceWith(
              j.callExpression(
                j.memberExpression(
                  j.identifier('console'),
                  j.identifier('error'),
                ),
                path.node.arguments,
              ),
            );
          });

        // Add a message to report
        context.messages.push('Replaced console.log with console.error');
      },
    );

    const transformer = createTransformer(transformFn);

    const result = transformer(mockFileInfo, mockApi, mockOptions);

    expect(transformFn).toHaveBeenCalled();

    // The result should be a string containing the transformed code
    expect(typeof result).toBe('string');
    expect(result).toContain('console.error(a);');

    // The report method should have been called with the message
    expect(mockReport).toHaveBeenCalledWith(
      'Replaced console.log with console.error',
    );
  });

  test('should return null when no changes are made', () => {
    // Create a transformer function that makes no changes
    const transformFn = vi.fn((fileInfo, api, options, context) => {
      // Intentionally do nothing
    });

    const transformer = createTransformer(transformFn);

    const result = transformer(mockFileInfo, mockApi, mockOptions);

    expect(transformFn).toHaveBeenCalled();

    // The result should be null since no changes were made
    expect(result).toBeNull();

    // The report method should not have been called
    expect(mockReport).not.toHaveBeenCalled();
  });

  test('should correctly initialize context with j and root', () => {
    let contextJ: JSCodeshift | undefined;
    let contextRoot: any;

    const transformFn = vi.fn((fileInfo, api, options, context) => {
      contextJ = context.j;
      contextRoot = context.root;
    });

    const transformer = createTransformer(transformFn);

    transformer(mockFileInfo, mockApi, mockOptions);

    expect(transformFn).toHaveBeenCalled();

    // Ensure that context.j and context.root are initialized
    expect(contextJ).toBe(jscodeshift);
    expect(contextRoot).toBeDefined();
  });

  test('should pass fileInfo, api, options, and context to the transform function', () => {
    const transformFn = vi.fn();

    const transformer = createTransformer(transformFn);

    transformer(mockFileInfo, mockApi, mockOptions);

    expect(transformFn).toHaveBeenCalledWith(
      mockFileInfo,
      mockApi,
      mockOptions,
      expect.objectContaining({
        j: jscodeshift,
        root: expect.anything(),
        hasChanges: false,
        messages: [],
      }),
    );
  });

  test('should handle multiple messages', () => {
    const transformFn = vi.fn((fileInfo, api, options, context) => {
      context.messages.push('First message');
      context.messages.push('Second message');
    });

    const transformer = createTransformer(transformFn);

    transformer(mockFileInfo, mockApi, mockOptions);

    // The report method should have been called with both messages
    expect(mockReport).toHaveBeenCalledTimes(2);
    expect(mockReport).toHaveBeenCalledWith('First message');
    expect(mockReport).toHaveBeenCalledWith('Second message');
  });
});
