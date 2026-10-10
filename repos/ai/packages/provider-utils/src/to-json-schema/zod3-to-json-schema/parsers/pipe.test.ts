import { describe, it, expect } from 'vitest';
import { z } from 'zod/v3';
import { parsePipelineDef } from './pipeline';
import { getRefs } from '../refs';
import type { JSONSchema7 } from '@ai-sdk/provider';

describe('pipe', () => {
  it('Should create an allOf schema with all its inner schemas represented', () => {
    const schema = z.number().pipe(z.number().int());

    expect(parsePipelineDef(schema._def, getRefs())).toStrictEqual({
      allOf: [{ type: 'number' }, { type: 'integer' }],
    } satisfies JSONSchema7);
  });

  it('Should parse the input schema if that strategy is selected', () => {
    const schema = z.number().pipe(z.number().int());

    expect(
      parsePipelineDef(schema._def, getRefs({ pipeStrategy: 'input' })),
    ).toStrictEqual({
      type: 'number',
    } satisfies JSONSchema7);
  });

  it('Should parse the output schema (last schema in pipe) if that strategy is selected', () => {
    const schema = z.string().pipe(z.date()).pipe(z.number().int());

    expect(
      parsePipelineDef(schema._def, getRefs({ pipeStrategy: 'output' })),
    ).toStrictEqual({
      type: 'integer',
    } satisfies JSONSchema7);
  });
});
