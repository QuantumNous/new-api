---
title: Basic usage
description: "Basic usage guide covering schema definition, parsing data, error handling, and type inference"
---

import { Tabs, Tab } from 'fumadocs-ui/components/tabs';
import { Callout } from "fumadocs-ui/components/callout";

This page will walk you through the basics of creating schemas, parsing data, and using inferred types. For complete documentation on Zod's schema API, refer to [Defining schemas](/api).

## Defining a schema

Before you can do anything else, you need to define a schema. For the purposes of this guide, we'll use a simple object schema.

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
import * as z from "zod"; 

const Player = z.object({ 
  username: z.string(),
  xp: z.number()
});
```
</Tab>
<Tab value="Zod Mini">
```ts
import * as z from "zod/mini"

const Player = z.object({ 
  username: z.string(),
  xp: z.number()
});
```
</Tab>
</Tabs>

## Parsing data

Given any Zod schema, use `.parse` to validate an input. If it's valid, Zod returns a strongly-typed *deep clone* of the input. 

```ts
Player.parse({ username: "billie", xp: 100 }); 
// => returns { username: "billie", xp: 100 }
```

<Callout>
**Note** — If your schema uses certain asynchronous APIs like `async` [refinements](/api#refinements) or [transforms](/api#transforms), you'll need to use the `.parseAsync()` method instead.

```ts
await Player.parseAsync({ username: "billie", xp: 100 }); 
```
</Callout>

## Handling errors

When validation fails, the `.parse()` method will throw a `ZodError` instance with granular information about the validation issues.

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
try {
  Player.parse({ username: 42, xp: "100" });
} catch(error){
  if(error instanceof z.ZodError){
    error.issues; 
    /* [
      {
        expected: 'string',
        code: 'invalid_type',
        path: [ 'username' ],
        message: 'Invalid input: expected string'
      },
      {
        expected: 'number',
        code: 'invalid_type',
        path: [ 'xp' ],
        message: 'Invalid input: expected number'
      }
    ] */
  }
}
```
</Tab>
<Tab value="Zod Mini">
```ts
try {
  Player.parse({ username: 42, xp: "100" });
} catch(error){
  if(error instanceof z.core.$ZodError){
    error.issues; 
    /* [
      {
        expected: 'string',
        code: 'invalid_type',
        path: [ 'username' ],
        message: 'Invalid input: expected string'
      },
      {
        expected: 'number',
        code: 'invalid_type',
        path: [ 'xp' ],
        message: 'Invalid input: expected number'
      }
    ] */
  }
}
```
</Tab>
</Tabs>

To avoid a `try/catch` block, you can use the `.safeParse()` method to get back a plain result object containing either the successfully parsed data or a `ZodError`. The result type is a [discriminated union](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions), so you can handle both cases conveniently.

```ts
const result = Player.safeParse({ username: 42, xp: "100" });
if (!result.success) {
  result.error;   // ZodError instance
} else {
  result.data;    // { username: string; xp: number }
}
```

<Callout>
**Note** — If your schema uses certain asynchronous APIs like `async` [refinements](/api#refinements) or [transforms](/api#transforms), you'll need to use the `.safeParseAsync()` method instead.

```ts
await schema.safeParseAsync("hello");
```
</Callout>

## Inferring types

Zod infers a static type from your schema definitions. You can extract this type with the `z.infer<>` utility and use it however you like.

```ts
const Player = z.object({ 
  username: z.string(),
  xp: z.number()
});

// extract the inferred type
type Player = z.infer<typeof Player>;

// use it in your code
const player: Player = { username: "billie", xp: 100 };
```

In some cases, the input & output types of a schema can diverge. For instance, the `.transform()` API can convert the input from one type to another. In these cases, you can extract the input and output types independently:

```ts
const mySchema = z.string().transform((val) => val.length);

type MySchemaIn = z.input<typeof mySchema>;
// => string

type MySchemaOut = z.output<typeof mySchema>; // equivalent to z.infer<typeof mySchema>
// number
```

---

Now that we have the basics covered, let's jump into the Schema API.
