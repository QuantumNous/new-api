---
title: "Metadata and registries"
description: "Attaching and manipulatinvg metadata on Zod schemas"
---

import { Tabs, Tab } from 'fumadocs-ui/components/tabs';
import { Callout } from "fumadocs-ui/components/callout"

{/* > Zod 4+ provides native `.toJSONSChema()` functionality that leverages registries to generate idiomatic JSON Schema from Zod. Refer to the [JSON SChema docs](/json-schema) page for more information. */}

It's often useful to associate a schema with some additional *metadata* for documentation, code generation, AI structured outputs, form validation, and other purposes.

## Registries

Metadata in Zod is handled via *registries*. Registries are collections of schemas, each associated with some *strongly-typed* metadata. To create a simple registry:

```ts
import * as z from "zod";

const myRegistry = z.registry<{ description: string }>();
```

To register, lookup, and remove schemas from this registry:

```ts
const mySchema = z.string();

myRegistry.add(mySchema, { description: "A cool schema!"});
myRegistry.has(mySchema); // => true
myRegistry.get(mySchema); // => { description: "A cool schema!" }
myRegistry.remove(mySchema);
myRegistry.clear(); // wipe registry
```

TypeScript enforces that the metadata for each schema matches the registry's **metadata type**.

```ts
myRegistry.add(mySchema, { description: "A cool schema!" }); // ✅
myRegistry.add(mySchema, { description: 123 }); // ❌
```

> **Special handling for `id`** —  Zod registries treat the `id` property specially. An `Error` will be thrown if multiple schemas are registered with the same `id` value. This is true for all registries, including the global registry.


### `.register()`

> **Note** — This method is special in that it does not return a new schema; instead, it returns the original schema. No other Zod method does this! That includes `.meta()` and `.describe()` (documented below) which return a new instance.

Schemas provide a `.register()` method to more conveniently add it to a registry.

```ts
const mySchema = z.string();

mySchema.register(myRegistry, { description: "A cool schema!" });
// => mySchema
```

This lets you define metadata "inline" in your schemas.

```ts
const mySchema = z.object({
  name: z.string().register(myRegistry, { description: "The user's name" }),
  age: z.number().register(myRegistry, { description: "The user's age" }),
})
```

<Callout>
If a registry is defined without a metadata type, you can use it as a generic "collection", no metadata required.

```ts
const myRegistry = z.registry();

myRegistry.add(z.string());
myRegistry.add(z.number());
```
</Callout>


## Metadata

### `z.globalRegistry`

For convenience, Zod provides a global registry (`z.globalRegistry`) that can be used to store metadata for JSON Schema generation or other purposes. It accepts the following metadata:

```ts
export interface GlobalMeta {
  id?: string ;
  title?: string ;
  description?: string;
  deprecated?: boolean;
  [k: string]: unknown;
}
```

To register some metadata in `z.globalRegistry` for a schema:

```ts
import * as z from "zod";

const emailSchema = z.email().register(z.globalRegistry, { 
  id: "email_address",
  title: "Email address",
  description: "Your email address",
  examples: ["first.last@example.com"]
});
```

To globally augment the `GlobalMeta` interface, use [*declaration merging*](https://www.typescriptlang.org/docs/handbook/declaration-merging.html). Add the following anywhere in your codebase. Creating a `zod.d.ts` file in your project root is a common convention.

```ts
declare module "zod" {
  interface GlobalMeta {
    // add new fields here
    examples?: unknown[];
  }
}

// forces TypeScript to consider the file a module
export {}
```

### `.meta()`

For a more convenient approach, use the `.meta()` method to register a schema in `z.globalRegistry`. 

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const emailSchema = z.email().meta({ 
  id: "email_address",
  title: "Email address",
  description: "Please enter a valid email address",
});
```
</Tab>
<Tab value="Zod Mini">
```ts
const emailSchema = z.email().check(
  z.meta({ 
    id: "email_address",
    title: "Email address",
    description: "Please enter a valid email address",
  })
);
```
</Tab>
</Tabs>

Calling `.meta()` without an argument will *retrieve* the metadata for a schema.


```ts
emailSchema.meta();
// => { id: "email_address", title: "Email address", ... }
```

Metadata is associated with a *specific schema instance.* This is important to keep in mind, especially since Zod methods are immutable—they always return a new instance.

```ts
const A = z.string().meta({ description: "A cool string" });
A.meta(); // => { description: "A cool string" }

const B = A.refine(_ => true);
B.meta(); // => undefined
```

### `.describe()`

<Callout>
The `.describe()` method remains available, but `.meta()` is the recommended approach.
</Callout>

The `.describe()` method is a shorthand for registering a schema in `z.globalRegistry` with just a `description` field.


<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const emailSchema = z.email();
emailSchema.describe("An email address");

// equivalent to
emailSchema.meta({ description: "An email address" });
```
</Tab>
<Tab value="Zod Mini">
```ts
const emailSchema = z.email().check(z.describe("An email address"));

// equivalent to
z.email().check(z.meta({ description: "An email address" }));
```
</Tab>
</Tabs>

## Custom registries

You've already seen a simple example of a custom registry:


```ts
import * as z from "zod";

const myRegistry = z.registry<{ description: string };>();
```

Let's look at some more advanced patterns.

### Referencing inferred types

It's often valuable for the metadata type to reference the *inferred type* of a schema. For instance, you may want an `examples` field to contain examples of the schema's output.

```ts
import * as z from "zod";

type MyMeta = { examples: z.$output[] };
const myRegistry = z.registry<MyMeta>();

myRegistry.add(z.string(), { examples: ["hello", "world"] });
myRegistry.add(z.number(), { examples: [1, 2, 3] });
```

The special symbol `z.$output` is a reference to the schemas inferred output type (`z.infer<typeof schema>`). Similarly you can use `z.$input` to reference the input type.

### Constraining schema types

Pass a second generic to `z.registry()` to constrain the schema types that can be added to a registry. This registry only accepts string schemas.

```ts
import * as z from "zod";

const myRegistry = z.registry<{ description: string }, z.ZodString>();

myRegistry.add(z.string(), { description: "A number" }); // ✅
myRegistry.add(z.number(), { description: "A number" }); // ❌ 
//             ^ 'ZodNumber' is not assignable to parameter of type 'ZodString' 
```
