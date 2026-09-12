import type { ZodReadonlyDef } from 'zod/v3';
import { parseDef } from '../parse-def';
import type { Refs } from '../refs';

export const parseReadonlyDef = (def: ZodReadonlyDef<any>, refs: Refs) => {
  return parseDef(def.innerType._def, refs);
};
