import type { ZodPromiseDef } from 'zod/v3';
import { parseDef } from '../parse-def';
import type { JsonSchema7Type } from '../parse-types';
import type { Refs } from '../refs';

export function parsePromiseDef(
  def: ZodPromiseDef,
  refs: Refs,
): JsonSchema7Type | undefined {
  return parseDef(def.type._def, refs);
}
