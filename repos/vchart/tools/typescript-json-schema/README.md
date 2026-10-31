# typescript-json-schema

Forked from [YousefED/typescript-json-schema](https://github.com/YousefED/typescript-json-schema).

[![npm version](https://img.shields.io/npm/v/typescript-json-schema.svg)](https://www.npmjs.com/package/typescript-json-schema) ![Test](https://github.com/YousefED/typescript-json-schema/workflows/Test/badge.svg)

Generate json-schemas from your Typescript sources.

## Features

- Compiles your Typescript program to get complete type information.
- Translates required properties, extends, annotation keywords, property initializers as defaults. You can find examples for these features in the [api doc](https://github.com/YousefED/typescript-json-schema/tree/master/api.md) or the [test examples](https://github.com/YousefED/typescript-json-schema/tree/master/test/programs).

## Usage

### Command line

- Install with `npm install typescript-json-schema -g`
- Generate schema from a typescript type: `typescript-json-schema project/directory/tsconfig.json TYPE`

To generate files for only _some_ types in `tsconfig.json` specify
filenames or globs with the `--include` option. This is especially useful for large projects.

In case no `tsconfig.json` is available for your project, you can directly specify the .ts files (this in this case we use some built-in compiler presets):

- Generate schema from a typescript type: `typescript-json-schema "project/directory/**/*.ts" TYPE`

The `TYPE` can either be a single, fully qualified type or `"*"` to generate the schema for all types.

```
Usage: typescript-json-schema <path-to-typescript-files-or-tsconfig> <type>

Options:
  --refs                Create shared ref definitions.                               [boolean] [default: true]
  --aliasRefs           Create shared ref definitions for the type aliases.          [boolean] [default: false]
  --topRef              Create a top-level ref definition.                           [boolean] [default: false]
  --titles              Creates titles in the output schema.                         [boolean] [default: false]
  --defaultProps        Create default properties definitions.                       [boolean] [default: false]
  --noExtraProps        Disable additional properties in objects by default.         [boolean] [default: false]
  --propOrder           Create property order definitions.                           [boolean] [default: false]
  --required            Create required array for non-optional properties.           [boolean] [default: false]
  --strictNullChecks    Make values non-nullable by default.                         [boolean] [default: false]
  --esModuleInterop     Use esModuleInterop when loading typescript modules.         [boolean] [default: false]
  --skipLibCheck        Use skipLibCheck when loading typescript modules.            [boolean] [default: false]
  --useTypeOfKeyword    Use `typeOf` keyword (https://goo.gl/DC6sni) for functions.  [boolean] [default: false]
  --out, -o             The output file, defaults to using stdout
  --validationKeywords  Provide additional validation keywords to include            [array]   [default: []]
  --include             Further limit tsconfig to include only matching files        [array]   [default: []]
  --ignoreErrors        Generate even if the program has errors.                     [boolean] [default: false]
  --excludePrivate      Exclude private members from the schema                      [boolean] [default: false]
  --uniqueNames         Use unique names for type symbols.                           [boolean] [default: false]
  --rejectDateType      Rejects Date fields in type definitions.                     [boolean] [default: false]
  --id                  Set schema id.                                               [string]  [default: ""]
  --defaultNumberType   Default number type.                                         [choices: "number", "integer"] [default: "number"]
  --tsNodeRegister      Use ts-node/register (needed for require typescript files).  [boolean] [default: false]
```

### Programmatic use

```ts
import { resolve } from 'path';

import * as TJS from 'typescript-json-schema';

// optionally pass argument to schema generator
const settings: TJS.PartialArgs = {
  required: true
};

// optionally pass ts compiler options
const compilerOptions: TJS.CompilerOptions = {
  strictNullChecks: true
};

// optionally pass a base path
const basePath = './my-dir';

const program = TJS.getProgramFromFiles([resolve('my-file.ts')], compilerOptions, basePath);

// We can either get the schema for one file and one type...
const schema = TJS.generateSchema(program, 'MyType', settings);

// ... or a generator that lets us incrementally get more schemas

const generator = TJS.buildGenerator(program, settings);

// generator can be also reused to speed up generating the schema if usecase allows:
const schemaWithReusedGenerator = TJS.generateSchema(program, 'MyType', settings, [], generator);

// all symbols
const symbols = generator.getUserSymbols();

// Get symbols for different types from generator.
generator.getSchemaForSymbol('MyType');
generator.getSchemaForSymbol('AnotherType');
```

```ts
// In larger projects type names may not be unique,
// while unique names may be enabled.
const settings: TJS.PartialArgs = {
  uniqueNames: true
};

const generator = TJS.buildGenerator(program, settings);

// A list of all types of a given name can then be retrieved.
const symbolList = generator.getSymbols('MyType');

// Choose the appropriate type, and continue with the symbol's unique name.
generator.getSchemaForSymbol(symbolList[1].name);

// Also it is possible to get a list of all symbols.
const fullSymbolList = generator.getSymbols();
```

`getSymbols('<SymbolName>')` and `getSymbols()` return an array of `SymbolRef`, which is of the following format:

```ts
type SymbolRef = {
  name: string;
  typeName: string;
  fullyQualifiedName: string;
  symbol: ts.Symbol;
};
```

`getUserSymbols` and `getMainFileSymbols` return an array of `string`.

### Annotations

The schema generator converts annotations to JSON schema properties.

For example

```ts
export interface Shape {
  /**
   * The size of the shape.
   *
   * @minimum 0
   * @TJS-type integer
   */
  size: number;
}
```

will be translated to

```json
{
  "$ref": "#/definitions/Shape",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "Shape": {
      "properties": {
        "size": {
          "description": "The size of the shape.",
          "minimum": 0,
          "type": "integer"
        }
      },
      "type": "object"
    }
  }
}
```

Note that we needed to use `@TJS-type` instead of just `@type` because of an [issue with the typescript compiler](https://github.com/Microsoft/TypeScript/issues/13498).

You can also override the type of array items, either listing each field in its own annotation or one
annotation with the full JSON of the spec (for special cases). This replaces the item types that would
have been inferred from the TypeScript type of the array elements.

Example:

```ts
export interface ShapesData {
  /**
   * Specify individual fields in items.
   *
   * @items.type integer
   * @items.minimum 0
   */
  sizes: number[];

  /**
   * Or specify a JSON spec:
   *
   * @items {"type":"string","format":"email"}
   */
  emails: string[];
}
```

Translation:

```json
{
  "$ref": "#/definitions/ShapesData",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "Shape": {
      "properties": {
        "sizes": {
          "description": "Specify individual fields in items.",
          "items": {
            "minimum": 0,
            "type": "integer"
          },
          "type": "array"
        },
        "emails": {
          "description": "Or specify a JSON spec:",
          "items": {
            "format": "email",
            "type": "string"
          },
          "type": "array"
        }
      },
      "type": "object"
    }
  }
}
```

This same syntax can be used for `contains` and `additionalProperties`.

### `integer` type alias

If you create a type alias `integer` for `number` it will be mapped to the `integer` type in the generated JSON schema.

Example:

```typescript
type integer = number;
interface MyObject {
  n: integer;
}
```

Note: this feature doesn't work for generic types & array types, it mainly works in very simple cases.

### `require` a variable from a file

(for requiring typescript files is needed to set argument `tsNodeRegister` to true)

When you want to import for example an object or an array into your property defined in annotation, you can use `require`.

Example:

```ts
export interface InnerData {
  age: number;
  name: string;
  free: boolean;
}

export interface UserData {
  /**
   * Specify required object
   *
   * @examples require("./example.ts").example
   */
  data: InnerData;
}
```

file `example.ts`

```ts
export const example: InnerData[] = [
  {
    age: 30,
    name: 'Ben',
    free: false
  }
];
```

Translation:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "properties": {
    "data": {
      "description": "Specify required object",
      "examples": [
        {
          "age": 30,
          "name": "Ben",
          "free": false
        }
      ],
      "type": "object",
      "properties": {
        "age": { "type": "number" },
        "name": { "type": "string" },
        "free": { "type": "boolean" }
      },
      "required": ["age", "free", "name"]
    }
  },
  "required": ["data"],
  "type": "object"
}
```

Also you can use `require(".").example`, which will try to find exported variable with name 'example' in current file. Or you can use `require("./someFile.ts")`, which will try to use default exported variable from 'someFile.ts'.

Note: For `examples` a required variable must be an array.

## Background

Inspired and builds upon [Typson](https://github.com/lbovet/typson/), but typescript-json-schema is compatible with more recent Typescript versions. Also, since it uses the Typescript compiler internally, more advanced scenarios are possible. If you are looking for a library that uses the AST instead of the type hierarchy and therefore better support for type aliases, have a look at [vega/ts-json-schema-generator](https://github.com/vega/ts-json-schema-generator).

## Debugging

`npm run debug -- test/programs/type-alias-single/main.ts --aliasRefs true MyString`

And connect via the debugger protocol.
