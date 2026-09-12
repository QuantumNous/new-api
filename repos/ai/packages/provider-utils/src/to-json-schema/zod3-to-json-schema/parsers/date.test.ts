import { describe, it, expect } from 'vitest';
import { z } from 'zod/v3';
import { parseDateDef } from './date';
import { getRefs } from '../refs';
import type { JSONSchema7 } from '@ai-sdk/provider';

describe('Date validations', it => {
  it('should be possible to date as a string type', () => {
    const zodDateSchema = z.date();
    const parsedSchemaWithOption = parseDateDef(
      zodDateSchema._def,
      getRefs({ dateStrategy: 'string' }),
    );
    const parsedSchemaFromDefault = parseDateDef(zodDateSchema._def, getRefs());

    const jsonSchema: JSONSchema7 = {
      type: 'string',
      format: 'date-time',
    };

    expect(parsedSchemaWithOption).toStrictEqual(jsonSchema);
    expect(parsedSchemaFromDefault).toStrictEqual(jsonSchema);
  });

  it('should be possible to describe minimum date', () => {
    const zodDateSchema = z
      .date()
      .min(new Date('1970-01-02'), { message: 'Too old' });
    const parsedSchema = parseDateDef(
      zodDateSchema._def,
      getRefs({ dateStrategy: 'integer' }),
    );

    expect(parsedSchema).toStrictEqual({
      type: 'integer',
      format: 'unix-time',
      minimum: 86400000,
    } satisfies JSONSchema7);
  });

  it('should be possible to describe maximum date', () => {
    const zodDateSchema = z.date().max(new Date('1970-01-02'));
    const parsedSchema = parseDateDef(
      zodDateSchema._def,
      getRefs({ dateStrategy: 'integer' }),
    );

    expect(parsedSchema).toStrictEqual({
      type: 'integer',
      format: 'unix-time',
      maximum: 86400000,
    } satisfies JSONSchema7);
  });

  it('should be possible to describe both maximum and minimum date', () => {
    const zodDateSchema = z
      .date()
      .min(new Date('1970-01-02'))
      .max(new Date('1972-01-02'));
    const parsedSchema = parseDateDef(
      zodDateSchema._def,
      getRefs({ dateStrategy: 'integer' }),
    );

    expect(parsedSchema).toStrictEqual({
      type: 'integer',
      format: 'unix-time',
      minimum: 86400000,
      maximum: 63158400000,
    } satisfies JSONSchema7);
  });

  it('multiple choices of strategy should result in anyOf', () => {
    const zodDateSchema = z.date();
    const parsedSchema = parseDateDef(
      zodDateSchema._def,
      getRefs({ dateStrategy: ['format:date-time', 'format:date', 'integer'] }),
    );

    expect(parsedSchema).toStrictEqual({
      anyOf: [
        {
          type: 'string',
          format: 'date-time',
        },
        {
          type: 'string',
          format: 'date',
        },
        {
          type: 'integer',
          format: 'unix-time',
        },
      ],
    } satisfies JSONSchema7);
  });
});
