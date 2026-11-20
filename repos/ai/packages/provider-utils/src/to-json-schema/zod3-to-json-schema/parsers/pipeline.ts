import type { ZodPipelineDef } from 'zod/v3';
import { parseDef } from '../parse-def';
import type { JsonSchema7Type } from '../parse-types';
import type { Refs } from '../refs';
import type { JsonSchema7AllOfType } from './intersection';

export const parsePipelineDef = (
  def: ZodPipelineDef<any, any>,
  refs: Refs,
): JsonSchema7AllOfType | JsonSchema7Type | undefined => {
  if (refs.pipeStrategy === 'input') {
    return parseDef(def.in._def, refs);
  } else if (refs.pipeStrategy === 'output') {
    return parseDef(def.out._def, refs);
  }

  const inputSchema = parseDef(def.in._def, {
    ...refs,
    currentPath: [...refs.currentPath, 'allOf', '0'],
  });
  const outputSchema = parseDef(def.out._def, {
    ...refs,
    currentPath: [...refs.currentPath, 'allOf', inputSchema ? '1' : '0'],
  });

  return {
    allOf: [inputSchema, outputSchema].filter(
      (schema): schema is JsonSchema7Type => schema !== undefined,
    ),
  };
};
