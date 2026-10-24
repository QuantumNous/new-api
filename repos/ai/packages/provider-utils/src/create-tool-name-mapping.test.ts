import type {
  LanguageModelV4FunctionTool,
  LanguageModelV4ProviderTool,
} from '@ai-sdk/provider';
import { describe, expect, it } from 'vitest';
import { createToolNameMapping } from './create-tool-name-mapping';

describe('createToolNameMapping', () => {
  it('should create mappings for provider-defined tools', () => {
    const tools: Array<
      LanguageModelV4FunctionTool | LanguageModelV4ProviderTool
    > = [
      {
        type: 'provider',
        id: 'anthropic.computer-use',
        name: 'custom-computer-tool',
        args: {},
      },
      {
        type: 'provider',
        id: 'openai.code-interpreter',
        name: 'custom-code-tool',
        args: {},
      },
    ];

    const providerToolNames: Record<`${string}.${string}`, string> = {
      'anthropic.computer-use': 'computer_use',
      'openai.code-interpreter': 'code_interpreter',
    };

    const mapping = createToolNameMapping({ tools, providerToolNames });

    expect(mapping.toProviderToolName('custom-computer-tool')).toBe(
      'computer_use',
    );
    expect(mapping.toProviderToolName('custom-code-tool')).toBe(
      'code_interpreter',
    );
    expect(mapping.toCustomToolName('computer_use')).toBe(
      'custom-computer-tool',
    );
    expect(mapping.toCustomToolName('code_interpreter')).toBe(
      'custom-code-tool',
    );
  });

  it('should ignore function tools', () => {
    const tools: Array<
      LanguageModelV4FunctionTool | LanguageModelV4ProviderTool
    > = [
      {
        type: 'function',
        name: 'my-function-tool',
        description: 'A function tool',
        inputSchema: { type: 'object' },
      },
    ];

    const providerToolNames: Record<`${string}.${string}`, string> = {};

    const mapping = createToolNameMapping({ tools, providerToolNames });

    expect(mapping.toProviderToolName('my-function-tool')).toBe(
      'my-function-tool',
    );
    expect(mapping.toCustomToolName('my-function-tool')).toBe(
      'my-function-tool',
    );
  });

  it('should return input name when tool is not in providerToolNames', () => {
    const tools: Array<
      LanguageModelV4FunctionTool | LanguageModelV4ProviderTool
    > = [
      {
        type: 'provider',
        id: 'unknown.tool',
        name: 'custom-tool',
        args: {},
      },
    ];

    const providerToolNames: Record<`${string}.${string}`, string> = {};

    const mapping = createToolNameMapping({ tools, providerToolNames });

    expect(mapping.toProviderToolName('custom-tool')).toBe('custom-tool');
    expect(mapping.toCustomToolName('unknown-name')).toBe('unknown-name');
  });

  it('should return input name when mapping does not exist', () => {
    const tools: Array<
      LanguageModelV4FunctionTool | LanguageModelV4ProviderTool
    > = [
      {
        type: 'provider',
        id: 'anthropic.computer-use',
        name: 'custom-computer-tool',
        args: {},
      },
    ];

    const providerToolNames: Record<`${string}.${string}`, string> = {
      'anthropic.computer-use': 'computer_use',
    };

    const mapping = createToolNameMapping({ tools, providerToolNames });

    expect(mapping.toProviderToolName('non-existent-tool')).toBe(
      'non-existent-tool',
    );
    expect(mapping.toCustomToolName('non-existent-provider-tool')).toBe(
      'non-existent-provider-tool',
    );
  });

  it('should handle empty tools array', () => {
    const tools: Array<
      LanguageModelV4FunctionTool | LanguageModelV4ProviderTool
    > = [];

    const providerToolNames: Record<`${string}.${string}`, string> = {};

    const mapping = createToolNameMapping({ tools, providerToolNames });

    expect(mapping.toProviderToolName('any-tool')).toBe('any-tool');
    expect(mapping.toCustomToolName('any-tool')).toBe('any-tool');
  });

  it('should handle mixed function and provider-defined tools', () => {
    const tools: Array<
      LanguageModelV4FunctionTool | LanguageModelV4ProviderTool
    > = [
      {
        type: 'function',
        name: 'function-tool',
        description: 'A function tool',
        inputSchema: { type: 'object' },
      },
      {
        type: 'provider',
        id: 'anthropic.computer-use',
        name: 'provider-tool',
        args: {},
      },
    ];

    const providerToolNames: Record<`${string}.${string}`, string> = {
      'anthropic.computer-use': 'computer_use',
    };

    const mapping = createToolNameMapping({ tools, providerToolNames });

    // Function tool should not be mapped
    expect(mapping.toProviderToolName('function-tool')).toBe('function-tool');
    expect(mapping.toCustomToolName('function-tool')).toBe('function-tool');

    // Provider-defined tool should be mapped
    expect(mapping.toProviderToolName('provider-tool')).toBe('computer_use');
    expect(mapping.toCustomToolName('computer_use')).toBe('provider-tool');
  });
});
