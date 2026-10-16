---
title: Zod Mini
description: "Zod Mini - a tree-shakable Zod"
---

import { Tabs, Tab } from 'fumadocs-ui/components/tabs';
import { Callout } from 'fumadocs-ui/components/callout';

<Callout type="info">
  **Note** — The docs for Zod Mini are interleaved with the regular Zod docs via tabbed code blocks. This page is designed to explain why Zod Mini exists, when to use it, and some key differences from regular Zod.
</Callout>

Zod Mini is a tree-shakable variant of Zod. To try it:

```sh
npm install zod@^4.0.0
```

To import it:

```ts
import * as z from "zod/mini";
```

Zod Mini implements the exact same functionality as `zod`, but using a *functional*, *tree-shakable* API. If you're coming from `zod`, this means you generally will use *functions* in place of methods.

```ts
// regular Zod
const mySchema = z.string().optional().nullable();

// Zod Mini
const mySchema = z.nullable(z.optional(z.string()));
```

## Tree-shaking

Tree-shaking is a technique used by modern bundlers to remove unused code from the final bundle. It's also referred to as *dead-code elimination*.

In regular Zod, schemas provide a range of convenience methods to perform some common operations (e.g. `.min()` on string schemas). Bundlers are generally not able to remove ("treeshake") unused method implementations from your bundle, but they are able to remove unused top-level functions. As such, the API of Zod Mini uses more functions than methods.

```ts
// regular Zod
z.string().min(5).max(10).trim()

// Zod Mini
z.string().check(z.minLength(5), z.maxLength(10), z.trim());
```

To give a general idea about the bundle size reduction, consider this simple script:

```ts
z.boolean().parse(true)
```

Bundling this with Zod and Zod Mini results in the following bundle sizes. Zod Mini results in a 64% reduction.

| Package | Bundle size (gzip) |
|---------|-------------|
| Zod Mini | `2.12kb` |
| Zod | `5.91kb` |

With a marginally more complex schema that involves object types:

```ts
const schema = z.object({ a: z.string(), b: z.number(), c: z.boolean() });

schema.parse({
  a: "asdf",
  b: 123,
  c: true,
});
```

| Package | Bundle size (gzip) |
|---------|-------------|
| Zod Mini | `4.0kb` |
| Zod | `13.1kb` |

This gives you a sense of the bundle sizes involved. Look closely at these numbers and run your own benchmarks to determine if using Zod Mini is worth it for your use case.

## When (not) to use Zod Mini

In general you should probably use regular Zod unless you have uncommonly strict constraints around bundle size. Many developers massively overestimate the importance of bundle size to application performance. In practice, bundle size on the scale of Zod (`5-10kb` typically) is only a meaningful concern when optimizing front-end bundles for a user base with slow mobile network connections in rural or developing areas. 

Let's run through some considerations:

### DX

The API of Zod Mini is more verbose and less discoverable. The methods in Zod's API are much easier to discover & autocomplete through Intellisense than the top-level functions in Zod Mini. It isn't possible to quickly build a schema with chained APIs. (Speaking as the creator of Zod: I spent a lot of time designing the Zod Mini API to be as ergonomic as possible, but I still have a strong preference the standard Zod API.)

### Backend development

If you are using Zod on the backend, bundle size on the scale of Zod is not meaningful. This is true even in resource-constrained environments like Lambda. [This post](https://medium.com/@adtanasa/size-is-almost-all-that-matters-for-optimizing-aws-lambda-cold-starts-cad54f65cbb) benchmarks cold start times with bundles of various sizes. Here is a subset of the results:

| Bundle size | Lambda cold start time |
|-------------|----------------|
| `1kb` | `171ms` |
| `17kb` (size of gzipped non-Mini Zod) | `171.6ms` (interpolated) |
| `128kb` | `176ms` |
| `256kb` | `182ms` |
| `512kb` | `279ms` |
| `1mb` | `557ms` |

The minimum cold start time for a negligible `1kb` bundle is `171ms`. The next bundle size tested is `128kb`, which added only `5ms`. When gzipped, the bundle size for the entirely of regular Zod is roughly `17kb`, which would correspond to a `0.6ms` increase in startup time. 

### Internet speed

Generally, the round trip time to the server (`100-200ms`) will dwarf the time required to download an additional `10kb`. Only on slow 3G connections (sub-`1Mbps`) does the download time for an additional `10kb` become more significant. If you aren't optimizing specifically for users in rural or developing areas, your time is likely better spent optimizing something else.

## `ZodMiniType`

All Zod Mini schemas extend the `z.ZodMiniType` base class, which in turn extends `z.core.$ZodType` from [`zod/v4/core`](/packages/core). While this class implements far fewer methods than `ZodType` in `zod`, some particularly useful methods remain.


### `.parse`

This is an obvious one. All Zod Mini schemas implement the same parsing methods as `zod`.

```ts
import * as z from "zod/mini"

const mySchema = z.string();

mySchema.parse('asdf')
await mySchema.parseAsync('asdf')
mySchema.safeParse('asdf')
await mySchema.safeParseAsync('asdf')
```

### `.check()`

In regular Zod there are dedicated methods on schema subclasses for performing common checks:

```ts
import * as z from "zod";

z.string()
  .min(5)
  .max(10)
  .refine(val => val.includes("@"))
  .trim()
```

In Zod Mini such methods aren't implemented. Instead you pass these checks into schemas using the `.check()` method:

```ts
import * as z from "zod/mini"

z.string().check(
  z.minLength(5), 
  z.maxLength(10),
  z.refine(val => val.includes("@")),
  z.trim()
);
```

The following checks are implemented. Some of these checks only apply to schemas of certain types (e.g. strings or numbers). The APIs are all type-safe; TypeScript won't let you add an unsupported check to your schema.

```ts
z.lt(value);
z.lte(value); // alias: z.maximum()
z.gt(value);
z.gte(value); // alias: z.minimum()
z.positive();
z.negative();
z.nonpositive();
z.nonnegative();
z.multipleOf(value);
z.maxSize(value);
z.minSize(value);
z.size(value);
z.maxLength(value);
z.minLength(value);
z.length(value);
z.regex(regex);
z.lowercase();
z.uppercase();
z.includes(value);
z.startsWith(value);
z.endsWith(value);
z.property(key, schema);
z.mime(value);

// custom checks
z.refine()
z.check()   // replaces .superRefine()

// mutations (these do not change the inferred types)
z.overwrite(value => newValue);
z.normalize();
z.trim();
z.toLowerCase();
z.toUpperCase();

// metadata (registers schema in z.globalRegistry)
z.meta({ title: "...", description: "..." });
z.describe("...");
```

### `.register()`

For registering a schema in a [registry](/metadata#registries).

```ts
const myReg = z.registry<{title: string}>();

z.string().register(myReg, { title: "My cool string schema" });
```

### `.brand()`

For *branding* a schema. Refer to the [Branded types](/api#branded-types) docs for more information.

```ts
import * as z from "zod/mini"

const USD = z.string().brand("USD");
```


### `.clone(def)`

Returns an identical clone of the current schema using the provided `def`.

```ts
const mySchema = z.string()

mySchema.clone(mySchema._zod.def);
```

## No default locale

While regular Zod automatically loads the English (`en`) locale, Zod Mini does not. This reduces the bundle size in scenarios where error messages are unnecessary, localized to a non-English language, or otherwise customized.

This means, by default the `message` property of all issues will simply read `"Invalid input"`. To load the English locale:

```ts
import * as z from "zod/mini"

z.config(z.locales.en());
```

Refer to the [Locales](/error-customization#internationalization) docs for more on localization.
