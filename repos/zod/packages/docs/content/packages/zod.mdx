---
title: Zod
description: "Internals and structure of the Zod library"
---

The `zod/v4` package is the "flagship" library of the Zod ecosystem. It strikes a balance between developer experience and bundle size that's ideal for the vast majority of applications. 

> If you have uncommonly strict constraints around bundle size, consider [Zod Mini](/packages/mini).

Zod aims to provide a schema API that maps one-to-one to TypeScript's type system.

```ts
import * as z from "zod";

const schema = z.object({
  name: z.string(),
  age: z.number().int().positive(),
  email: z.email(),
});
```

The API relies on methods to provide a concise, chainable, autocomplete-friendly way to define complex types.

```ts
z.string()
  .min(5)
  .max(10)
  .toLowerCase();
```

All schemas extend the `z.ZodType` base class, which in turn extends `z.$ZodType` from [`zod/v4/core`](/packages/core). All instance of `ZodType` implement the following methods:

```ts
import * as z from "zod";

const mySchema = z.string();

// parsing
mySchema.parse(data);
mySchema.safeParse(data);
mySchema.parseAsync(data);
mySchema.safeParseAsync(data);


// refinements
mySchema.refine(refinementFunc);
mySchema.superRefine(refinementFunc); // deprecated, use `.check()`
mySchema.overwrite(overwriteFunc);

// wrappers
mySchema.optional();
mySchema.nonoptional();
mySchema.nullable();
mySchema.nullish();
mySchema.default(defaultValue);
mySchema.array();
mySchema.or(otherSchema);
mySchema.transform(transformFunc);
mySchema.catch(catchValue);
mySchema.pipe(otherSchema);
mySchema.readonly();

// metadata and registries
mySchema.register(registry, metadata);
mySchema.describe(description);
mySchema.meta(metadata);

// utilities
mySchema.check(checkOrFunction);
mySchema.clone(def);
mySchema.brand<T>();
mySchema.isOptional(); // boolean
mySchema.isNullable(); // boolean
```
