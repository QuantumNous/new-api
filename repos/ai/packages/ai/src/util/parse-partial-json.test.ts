import { safeParseJSON } from '@ai-sdk/provider-utils';
import { fixJson } from './fix-json';
import { parsePartialJson } from './parse-partial-json';
import { JSONParseError } from '@ai-sdk/provider';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@ai-sdk/provider-utils');
vi.mock('./fix-json');

describe('parsePartialJson', () => {
  it('should handle nullish input', async () => {
    expect(await parsePartialJson(undefined)).toEqual({
      value: undefined,
      state: 'undefined-input',
    });
  });

  it('should parse valid JSON', async () => {
    const validJson = '{"key": "value"}';
    const parsedValue = { key: 'value' };

    vi.mocked(safeParseJSON).mockResolvedValueOnce({
      success: true,
      value: parsedValue,
      rawValue: parsedValue,
    });

    expect(await parsePartialJson(validJson)).toEqual({
      value: parsedValue,
      state: 'successful-parse',
    });
    expect(safeParseJSON).toHaveBeenCalledWith({ text: validJson });
  });

  it('should repair and parse partial JSON', async () => {
    const partialJson = '{"key": "value"';
    const fixedJson = '{"key": "value"}';
    const parsedValue = { key: 'value' };

    vi.mocked(safeParseJSON)
      .mockResolvedValueOnce({
        success: false,
        error: new JSONParseError({ text: partialJson, cause: undefined }),
        rawValue: partialJson,
      })
      .mockResolvedValueOnce({
        success: true,
        value: parsedValue,
        rawValue: parsedValue,
      });
    vi.mocked(fixJson).mockReturnValueOnce(fixedJson);

    expect(await parsePartialJson(partialJson)).toEqual({
      value: parsedValue,
      state: 'repaired-parse',
    });
    expect(safeParseJSON).toHaveBeenCalledWith({ text: partialJson });
    expect(fixJson).toHaveBeenCalledWith(partialJson);
    expect(safeParseJSON).toHaveBeenCalledWith({ text: fixedJson });
  });

  it('should handle invalid JSON that cannot be repaired', async () => {
    const invalidJson = 'not json at all';

    vi.mocked(safeParseJSON).mockResolvedValue({
      success: false,
      error: new JSONParseError({ text: invalidJson, cause: undefined }),
      rawValue: invalidJson,
    });
    vi.mocked(fixJson).mockReturnValueOnce(invalidJson);

    expect(await parsePartialJson(invalidJson)).toEqual({
      value: undefined,
      state: 'failed-parse',
    });
    expect(safeParseJSON).toHaveBeenCalledWith({ text: invalidJson });
    expect(fixJson).toHaveBeenCalledWith(invalidJson);
    expect(safeParseJSON).toHaveBeenCalledWith({ text: invalidJson });
  });
});
