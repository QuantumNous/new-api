import type { JsonSchema7AnyType } from './parsers/any';
import type { JsonSchema7ArrayType } from './parsers/array';
import type { JsonSchema7BigintType } from './parsers/bigint';
import type { JsonSchema7BooleanType } from './parsers/boolean';
import type { JsonSchema7DateType } from './parsers/date';
import type { JsonSchema7EnumType } from './parsers/enum';
import type { JsonSchema7AllOfType } from './parsers/intersection';
import type { JsonSchema7LiteralType } from './parsers/literal';
import type { JsonSchema7MapType } from './parsers/map';
import type { JsonSchema7NativeEnumType } from './parsers/native-enum';
import type { JsonSchema7NeverType } from './parsers/never';
import type { JsonSchema7NullType } from './parsers/null';
import type { JsonSchema7NullableType } from './parsers/nullable';
import type { JsonSchema7NumberType } from './parsers/number';
import type { JsonSchema7ObjectType } from './parsers/object';
import type { JsonSchema7RecordType } from './parsers/record';
import type { JsonSchema7SetType } from './parsers/set';
import type { JsonSchema7StringType } from './parsers/string';
import type { JsonSchema7TupleType } from './parsers/tuple';
import type { JsonSchema7UndefinedType } from './parsers/undefined';
import type { JsonSchema7UnionType } from './parsers/union';
import type { JsonSchema7UnknownType } from './parsers/unknown';

type JsonSchema7RefType = { $ref: string };
type JsonSchema7Meta = {
  title?: string;
  default?: any;
  description?: string;
};

export type JsonSchema7TypeUnion =
  | JsonSchema7StringType
  | JsonSchema7ArrayType
  | JsonSchema7NumberType
  | JsonSchema7BigintType
  | JsonSchema7BooleanType
  | JsonSchema7DateType
  | JsonSchema7EnumType
  | JsonSchema7LiteralType
  | JsonSchema7NativeEnumType
  | JsonSchema7NullType
  | JsonSchema7NumberType
  | JsonSchema7ObjectType
  | JsonSchema7RecordType
  | JsonSchema7TupleType
  | JsonSchema7UnionType
  | JsonSchema7UndefinedType
  | JsonSchema7RefType
  | JsonSchema7NeverType
  | JsonSchema7MapType
  | JsonSchema7AnyType
  | JsonSchema7NullableType
  | JsonSchema7AllOfType
  | JsonSchema7UnknownType
  | JsonSchema7SetType;

export type JsonSchema7Type = JsonSchema7TypeUnion & JsonSchema7Meta;
