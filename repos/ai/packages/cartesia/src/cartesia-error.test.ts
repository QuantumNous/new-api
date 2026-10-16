import { safeParseJSON } from '@ai-sdk/provider-utils';
import { cartesiaErrorDataSchema } from './cartesia-error';
import { describe, expect, it } from 'vitest';

describe('cartesiaErrorDataSchema', () => {
  it('should parse a Cartesia error', async () => {
    const error = JSON.stringify({
      error_code: 'authentication_failed',
      title: 'Authentication failed',
      message: 'Invalid API key.',
      request_id: '550e8400-e29b-41d4-a716-446655440000',
    });

    const result = await safeParseJSON({
      text: error,
      schema: cartesiaErrorDataSchema,
    });

    expect(result).toStrictEqual({
      success: true,
      value: {
        error_code: 'authentication_failed',
        title: 'Authentication failed',
        message: 'Invalid API key.',
        request_id: '550e8400-e29b-41d4-a716-446655440000',
      },
      rawValue: {
        error_code: 'authentication_failed',
        title: 'Authentication failed',
        message: 'Invalid API key.',
        request_id: '550e8400-e29b-41d4-a716-446655440000',
      },
    });
  });
});
