import { parseAnyDef, type JsonSchema7AnyType } from './any';
export type JsonSchema7UndefinedType = {
  not: JsonSchema7AnyType;
};

export function parseUndefinedDef(): JsonSchema7UndefinedType {
  return {
    not: parseAnyDef(),
  };
}
