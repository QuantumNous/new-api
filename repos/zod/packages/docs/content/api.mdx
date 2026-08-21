---
title: Defining schemas
description: "Complete API reference for all Zod schema types, methods, and validation features"
---

import { Tabs, Tab } from 'fumadocs-ui/components/tabs';
import { Callout } from "fumadocs-ui/components/callout"
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';

To validate data, you must first define a *schema*. Schemas represent *types*, from simple primitive values to complex nested objects and arrays. 

## Primitives

```ts
import * as z from "zod";

// primitive types
z.string();
z.number();
z.bigint();
z.boolean();
z.symbol();
z.undefined();
z.null();
```


### Coercion

To coerce input data to the appropriate type, use `z.coerce` instead:

```ts
z.coerce.string();    // String(input)
z.coerce.number();    // Number(input)
z.coerce.boolean();   // Boolean(input)
z.coerce.bigint();    // BigInt(input)
```

The coerced variant of these schemas attempts to convert the input value to the appropriate type.

```ts
const schema = z.coerce.string();

schema.parse("tuna");    // => "tuna"
schema.parse(42);        // => "42"
schema.parse(true);      // => "true"
schema.parse(null);      // => "null"
```

The input type of these coerced schemas is `unknown` by default. To specify a more specific input type, pass a generic parameter:

```ts
const A = z.coerce.number();
type AInput = z.input<typeof A>; // => unknown

const B = z.coerce.number<number>();
type BInput = z.input<typeof B>; // => number
```

<Accordions type="single">
<Accordion title="How coercion works in Zod">
  
  Zod coerces all inputs using the built-in constructors. 

  | Zod API                  | Coercion                   |
  |--------------------------|----------------------------|
  | `z.coerce.string()`      | `String(value)`            |
  | `z.coerce.number()`      | `Number(value)`            |
  | `z.coerce.boolean()`     | `Boolean(value)`           |
  | `z.coerce.bigint()`      | `BigInt(value)`            |
  | `z.coerce.date()`        | `new Date(value)`          |

  Boolean coercion with `z.coerce.boolean()` may not work how you expect. Any [truthy](https://developer.mozilla.org/en-US/docs/Glossary/Truthy) value is coerced to `true`, and any [falsy](https://developer.mozilla.org/en-US/docs/Glossary/Falsy) value is coerced to `false`.

  ```ts
  const schema = z.coerce.boolean(); // Boolean(input)

  schema.parse("tuna"); // => true
  schema.parse("true"); // => true
  schema.parse("false"); // => true
  schema.parse(1); // => true
  schema.parse([]); // => true

  schema.parse(0); // => false
  schema.parse(""); // => false
  schema.parse(undefined); // => false
  schema.parse(null); // => false
  ```

  For total control over coercion logic, consider using [`z.transform()`](#transforms) or [`z.pipe()`](#pipes).

</Accordion>
<Accordion title="Customizing the input type">
  
  By default the _input_ type of any `z.coerce` schema is `unknown`. In some cases, it may be preferable for the input type to be more specific. You can specify the input type with a generic parameter.

  ```ts
  const regularCoerce = z.coerce.string();
  type RegularInput = z.input<typeof regularCoerce>; // => unknown
  type RegularOutput = z.output<typeof regularCoerce>; // => string

  const customInput = z.coerce.string<string>();
  type CustomInput = z.input<typeof customInput>; // => string
  type CustomOutput = z.output<typeof customInput>; // => string
  ```

</Accordion>
</Accordions>



## Literals

Literal schemas represent a [literal type](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#literal-types), like `"hello world"` or `5`.

```ts
const tuna = z.literal("tuna");
const twelve = z.literal(12);
const twobig = z.literal(2n);
const tru = z.literal(true);
```

To represent the JavaScript literals `null` and `undefined`:

```ts
z.null();
z.undefined();
z.void(); // equivalent to z.undefined()
```

To allow multiple literal values:

```ts
const colors = z.literal(["red", "green", "blue"]);

colors.parse("green"); // ✅
colors.parse("yellow"); // ❌
```

To extract the set of allowed values from a literal schema:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
colors.values; // => Set<"red" | "green" | "blue">
```
</Tab>
<Tab value="Zod Mini">
```ts
// no equivalent
```
</Tab>
</Tabs>



## Strings

{/* Zod provides a handful of built-in string validation and transform APIs.

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
z.string().startsWith("fourscore")
```
</Tab>
<Tab value="Zod Mini">
```ts
z.string().check(z.startsWith("fourscore"))
```
</Tab>
</Tabs>

All of the APIs documented below support the `error` parameter for customizing the error message.

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
z.string().startsWith("fourscore", {error: "Nice try, buddy"})
```
</Tab>
<Tab value="Zod Mini">
```ts
z.string().check(z.startsWith("fourscore", {error: "Nice try, buddy"}))
```
</Tab></Tabs> */}


Zod provides a handful of built-in string validation and transform APIs. To perform some common string validations:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
z.string().max(5);
z.string().min(5);
z.string().length(5);
z.string().regex(/^[a-z]+$/);
z.string().startsWith("aaa");
z.string().endsWith("zzz");
z.string().includes("---");
z.string().uppercase();
z.string().lowercase();
```
</Tab>
<Tab value="Zod Mini">
```ts
z.string().check(z.maxLength(5));
z.string().check(z.minLength(5));
z.string().check(z.length(5));
z.string().check(z.regex(/^[a-z]+$/));
z.string().check(z.startsWith("aaa"));
z.string().check(z.endsWith("zzz"));
z.string().check(z.includes("---"));
z.string().check(z.uppercase());
z.string().check(z.lowercase());
```
</Tab>
</Tabs>

To perform some simple string transforms:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
z.string().trim(); // trim whitespace
z.string().toLowerCase(); // toLowerCase
z.string().toUpperCase(); // toUpperCase
z.string().normalize(); // normalize unicode characters
```
</Tab>
<Tab value="Zod Mini">
```ts
z.string().check(z.trim()); // trim whitespace
z.string().check(z.toLowerCase()); // toLowerCase
z.string().check(z.toUpperCase()); // toUpperCase
z.string().check(z.normalize()); // normalize unicode characters
```
</Tab>
</Tabs>

## String formats

To validate against some common string formats:

```ts
z.email();
z.uuid();
z.url();
z.httpUrl();       // http or https URLs only
z.hostname();
z.e164();          // E.164 phone numbers
z.emoji();         // validates a single emoji character
z.base64();
z.base64url();
z.hex();
z.jwt();
z.nanoid();
z.cuid();
z.cuid2();
z.ulid();
z.ipv4();
z.ipv6();
z.mac();
z.cidrv4();        // ipv4 CIDR block
z.cidrv6();        // ipv6 CIDR block
z.hash("sha256");  // or "sha1", "sha384", "sha512", "md5"
z.iso.date();
z.iso.time();
z.iso.datetime();
z.iso.duration();
```

### Emails

To validate email addresses:

```ts
z.email();
```

By default, Zod uses a comparatively strict email regex designed to validate normal email addresses containing common characters. It's roughly equivalent to the rules enforced by Gmail. To learn more about this regex, refer to [this post](https://colinhacks.com/essays/reasonable-email-regex).

```ts
/^(?!\.)(?!.*\.\.)([a-z0-9_'+\-\.]*)[a-z0-9_+-]@([a-z0-9][a-z0-9\-]*\.)+[a-z]{2,}$/i
```

To customize the email validation behavior, you can pass a custom regular expression to the `pattern` param.

```ts
z.email({ pattern: /your regex here/ });
```

Zod exports several useful regexes you could use.

```ts
// Zod's default email regex
z.email();
z.email({ pattern: z.regexes.email }); // equivalent

// the regex used by browsers to validate input[type=email] fields
// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/email
z.email({ pattern: z.regexes.html5Email });

// the classic emailregex.com regex (RFC 5322)
z.email({ pattern: z.regexes.rfc5322Email });

// a loose regex that allows Unicode (good for intl emails)
z.email({ pattern: z.regexes.unicodeEmail });
```

### UUIDs

To validate UUIDs:

```ts
z.uuid();
```

To specify a particular UUID version:

```ts
// supports "v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8"
z.uuid({ version: "v4" });

// for convenience
z.uuidv4();
z.uuidv6();
z.uuidv7();
```

The RFC 9562/4122 UUID spec requires the first two bits of byte 8 to be `10`. Other UUID-like identifiers do not enforce this constraint. To validate any UUID-like identifier:

```ts
z.guid();
```

### URLs

To validate any WHATWG-compatible URL:

```ts
const schema = z.url();

schema.parse("https://example.com"); // ✅
schema.parse("http://localhost"); // ✅
schema.parse("mailto:noreply@zod.dev"); // ✅
```

As you can see this is quite permissive. Internally this uses the `new URL()` constructor to validate inputs; this behavior may differ across platforms and runtimes but it's the mostly rigorous way to validate URIs/URLs on any given JS runtime/engine. 

To validate the hostname against a specific regex:

```ts
const schema = z.url({ hostname: /^example\.com$/ });

schema.parse("https://example.com"); // ✅
schema.parse("https://zombo.com"); // ❌
```

To validate the protocol against a specific regex, use the `protocol` param.

```ts
const schema = z.url({ protocol: /^https$/ });

schema.parse("https://example.com"); // ✅
schema.parse("http://example.com"); // ❌
```

<Callout>
  **Web URLs** — In many cases, you'll want to validate Web URLs specifically. Here's the recommended schema for doing so:

  ```ts
  const httpUrl = z.url({
    protocol: /^https?$/,
    hostname: z.regexes.domain
  });
  ```

  This restricts the protocol to `http`/`https` and ensures the hostname is a valid domain name with the `z.regexes.domain` regular expression:

  ```ts
  /^([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/
  ```
</Callout>

To normalize URLs, use the `normalize` flag. This will overwrite the input value with the [normalized URL](https://chatgpt.com/share/6881547f-bebc-800f-9093-f5981e277c2c) returned by `new URL()`.

```ts
new URL("HTTP://ExAmPle.com:80/./a/../b?X=1#f oo").href
// => "http://example.com/b?X=1#f%20oo"
```

### Phone numbers

To validate phone numbers in E.164 format:

```ts
const phone = z.e164();

phone.parse("+15555555555"); // ✅
phone.parse("555-555-5555"); // ❌
```

This schema validates strings with a leading `+`, a non-zero country code, and 7 to 15 digits total.

### ISO datetimes

As you may have noticed, Zod string includes a few date/time related validations. These validations are regular expression based, so they are not as strict as a full date/time library. However, they are very convenient for validating user input.

The `z.iso.datetime()` method enforces ISO 8601; by default, no timezone offsets are allowed:

```ts
const datetime = z.iso.datetime();

datetime.parse("2020-01-01T06:15:00Z"); // ✅
datetime.parse("2020-01-01T06:15:00.123Z"); // ✅
datetime.parse("2020-01-01T06:15:00.123456Z"); // ✅ (arbitrary precision)
datetime.parse("2020-01-01T06:15:00+02:00"); // ❌ (offsets not allowed)
datetime.parse("2020-01-01T06:15:00"); // ❌ (local not allowed)
```

To allow timezone offsets:

```ts
const datetime = z.iso.datetime({ offset: true });

// allows timezone offsets
datetime.parse("2020-01-01T06:15:00+02:00"); // ✅

// basic offsets not allowed
datetime.parse("2020-01-01T06:15:00+02");    // ❌
datetime.parse("2020-01-01T06:15:00+0200");  // ❌

// Z is still supported
datetime.parse("2020-01-01T06:15:00Z"); // ✅ 
```

To allow unqualified (timezone-less) datetimes:

```ts
const schema = z.iso.datetime({ local: true });
schema.parse("2020-01-01T06:15:01"); // ✅
schema.parse("2020-01-01T06:15"); // ✅ seconds optional
```

To constrain the allowable time `precision`. By default, seconds are optional and arbitrary sub-second precision is allowed.

```ts
const a = z.iso.datetime();
a.parse("2020-01-01T06:15Z"); // ✅
a.parse("2020-01-01T06:15:00Z"); // ✅
a.parse("2020-01-01T06:15:00.123Z"); // ✅

const b = z.iso.datetime({ precision: -1 }); // minute precision (no seconds)
b.parse("2020-01-01T06:15Z"); // ✅
b.parse("2020-01-01T06:15:00Z"); // ❌
b.parse("2020-01-01T06:15:00.123Z"); // ❌

const c = z.iso.datetime({ precision: 0 }); // second precision only
c.parse("2020-01-01T06:15Z"); // ❌
c.parse("2020-01-01T06:15:00Z"); // ✅
c.parse("2020-01-01T06:15:00.123Z"); // ❌

const d = z.iso.datetime({ precision: 3 }); // millisecond precision only
d.parse("2020-01-01T06:15Z"); // ❌
d.parse("2020-01-01T06:15:00Z"); // ❌
d.parse("2020-01-01T06:15:00.123Z"); // ✅
```

### ISO dates

The `z.iso.date()` method validates strings in the format `YYYY-MM-DD`.

```ts
const date = z.iso.date();

date.parse("2020-01-01"); // ✅
date.parse("2020-1-1"); // ❌
date.parse("2020-01-32"); // ❌
```

### ISO times

The `z.iso.time()` method validates strings in the format `HH:MM[:SS[.s+]]`. By default seconds are optional, as are sub-second decimals.

```ts
const time = z.iso.time();

time.parse("03:15"); // ✅
time.parse("03:15:00"); // ✅
time.parse("03:15:00.9999999"); // ✅ (arbitrary precision)
```

No offsets of any kind are allowed.

```ts
time.parse("03:15:00Z"); // ❌ (no `Z` allowed)
time.parse("03:15:00+02:00"); // ❌ (no offsets allowed)
```

Use the `precision` parameter to constrain the allowable decimal precision.

```ts
z.iso.time({ precision: -1 }); // HH:MM (minute precision)
z.iso.time({ precision: 0 });  // HH:MM:SS (second precision)
z.iso.time({ precision: 1 });  // HH:MM:SS.s (decisecond precision)
z.iso.time({ precision: 2 });  // HH:MM:SS.ss (centisecond precision)
z.iso.time({ precision: 3 });  // HH:MM:SS.sss (millisecond precision)
```

### IP addresses

```ts
const ipv4 = z.ipv4();
ipv4.parse("192.168.0.0"); // ✅

const ipv6 = z.ipv6();
ipv6.parse("2001:db8:85a3::8a2e:370:7334"); // ✅
```

### IP blocks (CIDR)

Validate IP address ranges specified with [CIDR notation](https://en.wikipedia.org/wiki/Classless_Inter-Domain_Routing).

```ts
const cidrv4 = z.cidrv4();
cidrv4.parse("192.168.0.0/24"); // ✅

const cidrv6 = z.cidrv6();
cidrv6.parse("2001:db8::/32"); // ✅
```

### MAC Addresses

Validate standard 48-bit MAC address [IEEE 802](https://en.wikipedia.org/wiki/MAC_address).

```ts
const mac = z.mac(); 
mac.parse("00:1A:2B:3C:4D:5E");  // ✅
mac.parse("00-1a-2b-3c-4d-5e");  // ❌ colon-delimited by default
mac.parse("001A:2B3C:4D5E");     // ❌ standard formats only
mac.parse("00:1A:2b:3C:4d:5E");  // ❌ no mixed case

// custom delimiter
const dashMac = z.mac({ delimiter: "-" });
dashMac.parse("00-1A-2B-3C-4D-5E"); // ✅
```

### JWTs

Validate [JSON Web Tokens](https://jwt.io/).

```ts
z.jwt();
z.jwt({ alg: "HS256" });
```

### Hashes

To validate cryptographic hash values:

```ts
z.hash("md5");
z.hash("sha1");
z.hash("sha256");
z.hash("sha384");
z.hash("sha512");
```

By default, `z.hash()` expects hexadecimal encoding, as is conventional. You can specify a different encoding with the `enc` parameter:

```ts
z.hash("sha256", { enc: "hex" });       // default
z.hash("sha256", { enc: "base64" });    // base64 encoding
z.hash("sha256", { enc: "base64url" }); // base64url encoding (no padding)
```

<Accordions>
<Accordion title="Expected lengths and padding">

| Algorithm / Encoding | `"hex"`  | `"base64"`  | `"base64url"`  |
|-----------|-----------|--------------|-----------------|
| `"md5"`   | 32        | 24 (22 + "==") | 22              |
| `"sha1"`  | 40        | 28 (27 + "=")  | 27              |
| `"sha256"`| 64        | 44 (43 + "=")  | 43              |
| `"sha384"`| 96        | 64 (no padding)| 64              |
| `"sha512"`| 128       | 88 (86 + "==") | 86              |

</Accordion>
</Accordions>

### Custom formats

To define your own string formats:

```ts
const coolId = z.stringFormat("cool-id", (val)=>{
  // arbitrary validation here
  return val.length === 100 && val.startsWith("cool-");
});

// a regex is also accepted
z.stringFormat("cool-id", /^cool-[a-z0-9]{95}$/);
```

This schema will produce `"invalid_format"` issues, which are more descriptive than the `"custom"` errors produced by refinements or `z.custom()`.

```ts
myFormat.parse("invalid input!");
// ZodError: [
//   {
//     "code": "invalid_format",
//     "format": "cool-id",
//     "path": [],
//     "message": "Invalid cool-id"
//   }
// ]
```

## Template literals

> Introduced in `zod@4.0`.

To define a template literal schema:

```ts
const schema = z.templateLiteral([ "hello, ", z.string(), "!" ]);
// `hello, ${string}!`
```

The `z.templateLiteral` API can handle any number of string literals (e.g. `"hello"`) and schemas. Any schema with an inferred type that's assignable to `string | number | bigint | boolean | null | undefined` can be passed.

```ts
z.templateLiteral([ "hi there" ]);
// `hi there`

z.templateLiteral([ "email: ", z.string() ]);
// `email: ${string}`

z.templateLiteral([ "high", z.literal(5) ]);
// `high5`

z.templateLiteral([ z.nullable(z.literal("grassy")) ]);
// `grassy` | `null`

z.templateLiteral([ z.number(), z.enum(["px", "em", "rem"]) ]);
// `${number}px` | `${number}em` | `${number}rem`
```

## Numbers

Use `z.number()` to validate numbers. It allows any finite number.

```ts
const schema = z.number();

schema.parse(3.14);      // ✅
schema.parse(NaN);       // ❌
schema.parse(Infinity);  // ❌
```

Zod implements a handful of number-specific validations:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
z.number().gt(5);
z.number().gte(5);                     // alias .min(5)
z.number().lt(5);
z.number().lte(5);                     // alias .max(5)
z.number().positive();                 // alias .gt(0)
z.number().nonnegative();    
z.number().negative(); 
z.number().nonpositive(); 
z.number().multipleOf(5);              // alias .step(5)
```
</Tab>
<Tab value="Zod Mini">
```ts
z.number().check(z.gt(5));
z.number().check(z.gte(5));            // alias .minimum(5)
z.number().check(z.lt(5));
z.number().check(z.lte(5));            // alias .maximum(5)
z.number().check(z.positive());        // alias .gt(0)
z.number().check(z.nonnegative()); 
z.number().check(z.negative()); 
z.number().check(z.nonpositive()); 
z.number().check(z.multipleOf(5));     // alias .step(5)
```
</Tab>
</Tabs>

If (for some reason) you want to validate `NaN`, use `z.nan()`.

```ts
z.nan().parse(NaN);              // ✅
z.nan().parse("anything else");  // ❌
```

## Integers

To validate integers:

```ts
z.int();     // restricts to safe integer range
z.int32();   // restrict to int32 range
```

## BigInts

To validate BigInts:

```ts
z.bigint();
```

Zod includes a handful of bigint-specific validations.

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
z.bigint().gt(5n);
z.bigint().gte(5n);                    // alias `.min(5n)`
z.bigint().lt(5n);
z.bigint().lte(5n);                    // alias `.max(5n)`
z.bigint().positive();                 // alias `.gt(0n)`
z.bigint().nonnegative(); 
z.bigint().negative(); 
z.bigint().nonpositive(); 
z.bigint().multipleOf(5n);             // alias `.step(5n)`
```
</Tab>
<Tab value="Zod Mini">
```ts
z.bigint().check(z.gt(5n));
z.bigint().check(z.gte(5n));           // alias `.minimum(5n)`
z.bigint().check(z.lt(5n));
z.bigint().check(z.lte(5n));           // alias `.maximum(5n)`
z.bigint().check(z.positive());        // alias `.gt(0n)`
z.bigint().check(z.nonnegative());
z.bigint().check(z.negative());
z.bigint().check(z.nonpositive());
z.bigint().check(z.multipleOf(5n));    // alias `.step(5n)`
```

</Tab>
</Tabs>

## Booleans

To validate boolean values:

```ts
z.boolean().parse(true); // => true
z.boolean().parse(false); // => false
```

## Dates

Use `z.date()` to validate `Date` instances.

```ts
z.date().safeParse(new Date()); // success: true
z.date().safeParse("2022-01-12T06:15:00.000Z"); // success: false
```

To customize the error message:

```ts
z.date({
  error: issue => issue.input === undefined ? "Required" : "Invalid date"
});
```

Zod provides a handful of date-specific validations.

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
z.date().min(new Date("1900-01-01"), { error: "Too old!" });
z.date().max(new Date(), { error: "Too young!" });
```
</Tab>
<Tab value="Zod Mini">
```ts
z.date().check(z.minimum(new Date("1900-01-01"), { error: "Too old!" }));
z.date().check(z.maximum(new Date(), { error: "Too young!" }));
```
</Tab>
</Tabs>

<div id="zod-enums" style={{height:"0px" }} /> 

## Enums

Use `z.enum` to validate inputs against a fixed set of allowable _string_ values.

```ts
const FishEnum = z.enum(["Salmon", "Tuna", "Trout"]);

FishEnum.parse("Salmon"); // => "Salmon"
FishEnum.parse("Swordfish"); // => ❌
```

<Callout>
  Careful — If you declare your string array as a variable, Zod won't be able to properly infer the exact values of each element.

  ```ts
  const fish = ["Salmon", "Tuna", "Trout"];
  
  const FishEnum = z.enum(fish);
  type FishEnum = z.infer<typeof FishEnum>; // string
  ```

  To fix this, always pass the array directly into the `z.enum()` function, or use [`as const`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions).

  ```ts
  const fish = ["Salmon", "Tuna", "Trout"] as const;

  const FishEnum = z.enum(fish);
  type FishEnum = z.infer<typeof FishEnum>; // "Salmon" | "Tuna" | "Trout"
  ```
</Callout>

Enum-like object literals (`{ [key: string]: string | number }`) are supported. 

```ts
const Fish = {
  Salmon: 0,
  Tuna: 1
} as const

const FishEnum = z.enum(Fish)
FishEnum.parse(Fish.Salmon); // => ✅
FishEnum.parse(0); // => ✅
FishEnum.parse(2); // => ❌
```

You can also pass in an externally-declared TypeScript enum.

```ts
enum Fish {
  Salmon = 0,
  Tuna = 1
}

const FishEnum = z.enum(Fish);
FishEnum.parse(Fish.Salmon); // => ✅
FishEnum.parse(0); // => ✅
FishEnum.parse(2); // => ❌
```

<Callout>
Use `z.enum()` for externally declared TypeScript enums. The `z.nativeEnum()` API is deprecated.

Note that using TypeScript's `enum` keyword is [not recommended](https://www.totaltypescript.com/why-i-dont-like-typescript-enums). 
</Callout>

```ts
enum Fish {
  Salmon = "Salmon",
  Tuna = "Tuna",
  Trout = "Trout",
}

const FishEnum = z.enum(Fish);
```

### `.enum`

To extract the schema's values as an enum-like object:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const FishEnum = z.enum(["Salmon", "Tuna", "Trout"]);

FishEnum.enum;
// => { Salmon: "Salmon", Tuna: "Tuna", Trout: "Trout" }
```
</Tab>
<Tab value="Zod Mini">
```ts
const FishEnum = z.enum(["Salmon", "Tuna", "Trout"]);

FishEnum.def.entries;
// => { Salmon: "Salmon", Tuna: "Tuna", Trout: "Trout" }
```
</Tab>
</Tabs>

### `.exclude()`

To create a new enum schema, excluding certain values:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const FishEnum = z.enum(["Salmon", "Tuna", "Trout"]);
const TunaOnly = FishEnum.exclude(["Salmon", "Trout"]);
```
</Tab>
<Tab value="Zod Mini">
```ts
// no equivalent
 
```
</Tab>
</Tabs>

### `.extract()`

To create a new enum schema, extracting certain values:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const FishEnum = z.enum(["Salmon", "Tuna", "Trout"]);
const SalmonAndTroutOnly = FishEnum.extract(["Salmon", "Trout"]);
```
</Tab>
<Tab value="Zod Mini">
```ts
// no equivalent
 
```
</Tab>
</Tabs>

## Stringbools [#stringbool]

> Introduced in `zod@4.0`.

In some cases (e.g. parsing environment variables) it's valuable to parse certain string "boolish" values to a plain `boolean` value. Use `z.stringbool()` for this:

```ts
const strbool = z.stringbool();

strbool.parse("true")         // => true
strbool.parse("1")            // => true
strbool.parse("yes")          // => true
strbool.parse("on")           // => true
strbool.parse("y")            // => true
strbool.parse("enabled")      // => true

strbool.parse("false");       // => false
strbool.parse("0");           // => false
strbool.parse("no");          // => false
strbool.parse("off");         // => false
strbool.parse("n");           // => false
strbool.parse("disabled");    // => false

strbool.parse(/* anything else */); // ZodError<[{ code: "invalid_value" }]>
```

To customize the truthy and falsy values:

```ts
// these are the defaults
z.stringbool({
  truthy: ["true", "1", "yes", "on", "y", "enabled"],
  falsy: ["false", "0", "no", "off", "n", "disabled"],
});
```

By default the schema is *case-insensitive*; all inputs are converted to lowercase before comparison to the `truthy`/`falsy` values. To make it case-sensitive:

```ts
z.stringbool({
  case: "sensitive"
});
```


## Optionals

To make a schema *optional* (that is, to allow `undefined` inputs).

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
z.optional(z.literal("yoda")); // or z.literal("yoda").optional()
```
</Tab>
<Tab value="Zod Mini">
```ts
z.optional(z.literal("yoda"));
```
</Tab>
</Tabs>

This returns a `ZodOptional` instance that wraps the original schema. To extract the inner schema:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
optionalYoda.unwrap(); // ZodLiteral<"yoda">
```
</Tab>
<Tab value="Zod Mini">
```ts
optionalYoda.def.innerType; // ZodMiniLiteral<"yoda">
```
</Tab>
</Tabs>

## Nullables

To make a schema *nullable* (that is, to allow `null` inputs).

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
z.nullable(z.literal("yoda")); // or z.literal("yoda").nullable()
```
</Tab>
<Tab value="Zod Mini">
```ts
const nullableYoda = z.nullable(z.literal("yoda"));
```
</Tab>
</Tabs>

This returns a `ZodNullable` instance that wraps the original schema. To extract the inner schema:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
nullableYoda.unwrap(); // ZodLiteral<"yoda">
```
</Tab>
<Tab value="Zod Mini">
```ts
nullableYoda.def.innerType; // ZodMiniLiteral<"yoda">
```
</Tab>
</Tabs>

## Nullish

To make a schema *nullish* (both optional and nullable):

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const nullishYoda = z.nullish(z.literal("yoda"));
```
</Tab>
<Tab value="Zod Mini">
```ts
const nullishYoda = z.nullish(z.literal("yoda"));
```
</Tab>
</Tabs>

Refer to the TypeScript manual for more about the concept of [nullish](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#nullish-coalescing).

## Unknown

Zod aims to mirror TypeScript's type system one-to-one. As such, Zod provides APIs to represent the following special types:

```ts
// allows any values
z.any(); // inferred type: `any`
z.unknown(); // inferred type: `unknown`
```

## Never

No value will pass validation.

```ts
z.never(); // inferred type: `never`
```

## Objects

To define an object type:

```ts z.object
  // all properties are required by default
  const Person = z.object({
    name: z.string(),
    age: z.number(),
  });

  type Person = z.infer<typeof Person>;
  // => { name: string; age: number; }
  ```
By default, all properties are required. To make certain properties optional:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts z.object
const Dog = z.object({
  name: z.string(),
  age: z.number().optional(),
});

Dog.parse({ name: "Yeller" }); // ✅
```
</Tab>
<Tab value="Zod Mini">
```ts z.object
const Dog = z.object({
  name: z.string(),
  age: z.optional(z.number())
});

Dog.parse({ name: "Yeller" }); // ✅
```
</Tab>
</Tabs>



By default, unrecognized keys are *stripped* from the parsed result:

```ts z.object
Dog.parse({ name: "Yeller", extraKey: true });
// => { name: "Yeller" }
```

### `z.strictObject`

To define a *strict* schema that throws an error when unknown keys are found:

```ts z.object
const StrictDog = z.strictObject({
  name: z.string(),
});

StrictDog.parse({ name: "Yeller", extraKey: true });
// ❌ throws
```

### `z.looseObject`

To define a *loose* schema that allows unknown keys to pass through:

```ts z.object
const LooseDog = z.looseObject({
  name: z.string(),
});

LooseDog.parse({ name: "Yeller", extraKey: true });
// => { name: "Yeller", extraKey: true }
```

### `.catchall()`

To define a *catchall schema* that will be used to validate any unrecognized keys:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts z.object
const DogWithStrings = z
  .object({
    name: z.string(),
    age: z.number().optional(),
  })
  .catchall(z.string());


DogWithStrings.parse({ name: "Yeller", extraKey: "extraValue" }); // ✅
DogWithStrings.parse({ name: "Yeller", extraKey: 42 }); // ❌
```
</Tab>
<Tab value="Zod Mini">
```ts z.object
const DogWithStrings = z.catchall(
  z.object({
    name: z.string(),
    age: z.number().optional(),
  }),
  z.string()
);

DogWithStrings.parse({ name: "Yeller", extraKey: "extraValue" }); // ✅
DogWithStrings.parse({ name: "Yeller", extraKey: 42 }); // ❌
```
</Tab>
</Tabs>


### `.shape`

To access the internal schemas:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
Dog.shape.name; // => string schema
Dog.shape.age; // => number schema
```
</Tab>
<Tab value="Zod Mini">
```ts
Dog.def.shape.name; // => string schema
Dog.def.shape.age; // => number schema
```
</Tab>
</Tabs>

### `.keyof()`

To create a `ZodEnum` schema from the keys of an object schema:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const keySchema = Dog.keyof();
// => ZodEnum<["name", "age"]>
```
</Tab>
<Tab value="Zod Mini">
```ts
const keySchema = z.keyof(Dog);
// => ZodEnum<["name", "age"]>
```
</Tab>
</Tabs>

### `.extend()`

To add additional fields to an object schema:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const DogWithBreed = Dog.extend({
  breed: z.string(),
});
```
</Tab>
<Tab value="Zod Mini">
```ts
const DogWithBreed = z.extend(Dog, {
  breed: z.string(),
});
```
</Tab>
</Tabs>

This API can be used to overwrite existing fields! Be careful with this power! If the two schemas share keys, B will override A.

<Callout>
**Alternative: spread syntax** — You can alternatively avoid `.extend()` altogether by creating a new object schema entirely. This makes the strictness level of the resulting schema visually obvious.

```ts
const DogWithBreed = z.object({ // or z.strictObject() or z.looseObject()...
  ...Dog.shape,
  breed: z.string(),
});
```

You can also use this to merge multiple objects in one go.

```ts
const DogWithBreed = z.object({
  ...Animal.shape,
  ...Pet.shape,
  breed: z.string(),
});
```

This approach has a few advantages:

1. It uses language-level features ([spread syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax)) instead of library-specific APIs
2. The same syntax works in Zod and Zod Mini
3. It's more `tsc`-efficient — the `.extend()` method can be expensive on large schemas, and due to [a TypeScript limitation](https://github.com/microsoft/TypeScript/pull/61505) it gets quadratically more expensive when calls are chained
4. If you wish, you can change the strictness level of the resulting schema by using `z.strictObject()` or `z.looseObject()`
</Callout>

### `.safeExtend()`

The `.safeExtend()` method works similarly to `.extend()`, but it won't let you overwrite an existing property with a non-assignable schema. In other words, the result of `.safeExtend()` will have an inferred type that [`extends`](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#conditional-type-constraints) the original (in the TypeScript sense).

```ts
z.object({ a: z.string() }).safeExtend({ a: z.string().min(5) }); // ✅
z.object({ a: z.string() }).safeExtend({ a: z.any() }); // ✅
z.object({ a: z.string() }).safeExtend({ a: z.number() });
//                                       ^  ❌ ZodNumber is not assignable 
```

Use `.safeExtend()` to extend schemas that contain refinements. (Regular `.extend()` will throw an error when used on schemas with refinements.)

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const Base = z.object({
  a: z.string(),
  b: z.string()
}).refine(user => user.a === user.b);

// Extended inherits the refinements of Base
const Extended = Base.safeExtend({
  a: z.string().min(10)
});
```
</Tab>
<Tab value="Zod Mini">
```ts
const Base = z.object({
  a: z.string(),
  b: z.string()
}).check(z.refine(user => user.a === user.b));

// Extended inherits the refinements of Base
const Extended = z.safeExtend(Base, {
  a: z.string().min(10)
});
```
</Tab>
</Tabs>

### `.pick()`

Inspired by TypeScript's built-in `Pick` and `Omit` utility types, Zod provides dedicated APIs for picking and omitting certain keys from an object schema.

Starting from this initial schema:

```ts z.object
const Recipe = z.object({
  title: z.string(),
  description: z.string().optional(),
  ingredients: z.array(z.string()),
});
// { title: string; description?: string | undefined; ingredients: string[] }
```
To pick certain keys:


<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts zod
const JustTheTitle = Recipe.pick({ title: true });
```
</Tab>
<Tab value="Zod Mini">
```ts
const JustTheTitle = z.pick(Recipe, { title: true });
```
</Tab>
</Tabs>


### `.omit()`

To omit certain keys:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts zod
const RecipeNoId = Recipe.omit({ id: true });
```
</Tab>
<Tab value="Zod Mini">
```ts
const RecipeNoId = z.omit(Recipe, { id: true });
```
</Tab>
</Tabs>


### `.partial()`

For convenience, Zod provides a dedicated API for making some or all properties optional, inspired by the built-in TypeScript utility type [`Partial`](https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype).


To make all fields optional:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts zod
const PartialRecipe = Recipe.partial();
// { title?: string | undefined; description?: string | undefined; ingredients?: string[] | undefined }
```
</Tab>
<Tab value="Zod Mini">
```ts
const PartialRecipe = z.partial(Recipe);
// { title?: string | undefined; description?: string | undefined; ingredients?: string[] | undefined }
```
</Tab>
</Tabs>

To make certain properties optional:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts zod
const RecipeOptionalIngredients = Recipe.partial({
  ingredients: true,
});
// { title: string; description?: string | undefined; ingredients?: string[] | undefined }
```
</Tab>
<Tab value="Zod Mini">
```ts
const RecipeOptionalIngredients = z.partial(Recipe, {
  ingredients: true,
});
// { title: string; description?: string | undefined; ingredients?: string[] | undefined }
```
</Tab>
</Tabs>

### `.required()`

Zod provides an API for making some or all properties *required*, inspired by TypeScript's [`Required`](https://www.typescriptlang.org/docs/handbook/utility-types.html#requiredtype) utility type.

To make all properties required:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts zod
const RequiredRecipe = Recipe.required();
// { title: string; description: string; ingredients: string[] }
```
</Tab>
<Tab value="Zod Mini">
```ts
const RequiredRecipe = z.required(Recipe);
// { title: string; description: string; ingredients: string[] }
```
</Tab>
</Tabs>

To make certain properties required:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts zod
const RecipeRequiredDescription = Recipe.required({description: true});
// { title: string; description: string; ingredients: string[] }
```
</Tab>
<Tab value="Zod Mini">
```ts
const RecipeRequiredDescription = z.required(Recipe, {description: true});
// { title: string; description: string; ingredients: string[] }
```
</Tab>
</Tabs>



## Recursive objects

To define a self-referential type, use a [getter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/get) on the key. This lets JavaScript resolve the cyclical schema at runtime.

```ts
const Category = z.object({
  name: z.string(),
  get subcategories(){
    return z.array(Category)
  }
});

type Category = z.infer<typeof Category>;
// { name: string; subcategories: Category[] }
```

<Callout type="warn"> 
  Though recursive schemas are supported, passing cyclical data into Zod will cause an infinite loop.
</Callout>

You can also represent *mutually recursive types*:

```ts
const User = z.object({
  email: z.email(),
  get posts(){
    return z.array(Post)
  }
});

const Post = z.object({
  title: z.string(),
  get author(){
    return User
  }
});
```

All object APIs (`.pick()`, `.omit()`, `.required()`, `.partial()`, etc.) work as you'd expect.

### Circularity errors

Due to TypeScript limitations, recursive type inference can be finicky, and it only works in certain scenarios. Some more complicated types may trigger recursive type errors like this:

```ts
const Activity = z.object({
  name: z.string(),
  get subactivities() {
    // ^ ❌ 'subactivities' implicitly has return type 'any' because it does not
    // have a return type annotation and is referenced directly or indirectly
    // in one of its return expressions.ts(7023)

    return z.nullable(z.array(Activity));
  },
});
```

In these cases, you can resolve the error with a type annotation on the offending getter:

```ts
const Activity = z.object({
  name: z.string(),
  get subactivities(): z.ZodNullable<z.ZodArray<typeof Activity>> {
    return z.nullable(z.array(Activity));
  },
});
```

{/* Some general rules of thumb for avoiding circularity  */}

{/* 
<Accordions>
  <Accordion title="Resolving type errors in recursive schemas">
    Recursive type inference can by mysterious. TypeScript is capable of it in certain limited scenarios. Depending on what you're trying to do, you may encounter errors like this:

    ```ts
    export const Activity = z.object({
      name: z.string(),
      get children() {
        // ^ ❌ 'children' implicitly has return type 'any' because it does not 
        // have a return type annotation and is referenced directly or indirectly 
        // in one of its return expressions.ts(7023)

        return z.optional(z.array(Activity)); //.optional();
      },
    });
    ```

    Here are a couple rules of thumb:

    ### Object types only 
    
    Generally speaking, recursive inference only works with object types that are referencing each other. TypeScript has special handling for resolving getter-based recursive objects, which is what Zod relies on. If you try to add non-object types into the mix, you'll likely encounter errors.

    ```ts
    const Activity = z.object({
      name: z.string(),
      get children() { // ❌ type error
        return z.optional(ActivityArray);
      },
    });

    const ActivityArray = z.array(Activity);
    ```

    Sometimes you can get around this limitation by defining 


    ### Avoid nesting function calls
    
    Functions like `z.array()` and `z.optional()` accept Zod schemas, so when you use them TypeScript will do some type-checking on their inputs to make sure they are valid. But type checking is the enemy of recursive type inference—it's hard for TypeScript to *check* and *infer* types at the same time. Methods do not have this problem, so prefer methods over functions when possible (sorry Zod Mini users).

    ```ts
    const Activity = z.object({
      name: z.string(),
      get subactivities() {
        // ^ ❌ 'subactivities' implicitly has return type 'any' because it does not 
        // have a return type annotation and is referenced directly or indirectly 
        // in one of its return expressions.ts(7023)

        return z.union([z.null(), Activity]);
      },
    });
    ```

    ### Fall back to type annotations on your getters
    
    When in doubt, you can generally sidestep these issues with some carefully deployed type annotations on your getters. Due to the limitations described above, this is particularly necessary when using Zod Mini.

    ```ts
    import * as z from "zod";

    const Activity = z.object({
      name: z.string(),
      get subactivities(): z.ZodMiniDefault<z.ZodMiniArray<typeof Activity>> {
        return z._default(z.array(Activity), []);
      },
    });
    ```

  </Accordion>
</Accordions> */}

## Arrays

To define an array schema:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const stringArray = z.array(z.string()); // or z.string().array()
```
</Tab>
<Tab value="Zod Mini">
```ts
const stringArray = z.array(z.string());
```
</Tab>
</Tabs>

To access the inner schema for an element of the array.

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
stringArray.unwrap(); // => string schema
```
</Tab>
<Tab value="Zod Mini">
```ts
stringArray.def.element; // => string schema
```
</Tab>
</Tabs>

Zod implements a number of array-specific validations:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
z.array(z.string()).min(5); // must contain 5 or more items
z.array(z.string()).max(5); // must contain 5 or fewer items
z.array(z.string()).length(5); // must contain 5 items exactly
```
</Tab>
<Tab value="Zod Mini">
```ts
z.array(z.string()).check(z.minLength(5)); // must contain 5 or more items
z.array(z.string()).check(z.maxLength(5)); // must contain 5 or fewer items
z.array(z.string()).check(z.length(5)); // must contain 5 items exactly
```
</Tab>
</Tabs>

{/* Unlike `.nonempty()` these methods do not change the inferred type. */}

## Tuples

Unlike arrays, tuples are typically fixed-length arrays that specify different schemas for each index.

```ts
const MyTuple = z.tuple([
  z.string(),
  z.number(),
  z.boolean()
]);

type MyTuple = z.infer<typeof MyTuple>;
// [string, number, boolean]
```

To add a variadic ("rest") argument:

```ts
const variadicTuple = z.tuple([z.string()], z.number());
// => [string, ...number[]];
```

## Unions

Union types (`A | B`) represent a logical "OR". Zod union schemas will check the input against each option in order. The first value that validates successfully is returned.

```ts
const stringOrNumber = z.union([z.string(), z.number()]);
// string | number

stringOrNumber.parse("foo"); // passes
stringOrNumber.parse(14); // passes
```

To extract the internal option schemas:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
stringOrNumber.options; // [ZodString, ZodNumber]
```
</Tab>
<Tab value="Zod Mini">
```ts
stringOrNumber.def.options; // [ZodString, ZodNumber]
```
</Tab>
</Tabs>

{/* For convenience, you can also use the [`.or` method](#or):

```ts
const stringOrNumber = z.string().or(z.number());
``` */}

{/* **Optional string validation:**

To validate an optional form input, you can union the desired string validation with an empty string [literal](#literals).

This example validates an input that is optional but needs to contain a [valid URL](#strings):

```ts
const optionalUrl = z.union([z.string().url().nullish(), z.literal("")]);

console.log(optionalUrl.safeParse(undefined).success); // true
console.log(optionalUrl.safeParse(null).success); // true
console.log(optionalUrl.safeParse("").success); // true
console.log(optionalUrl.safeParse("https://zod.dev").success); // true
console.log(optionalUrl.safeParse("not a valid url").success); // false
```

<br/> */}

## Exclusive unions (XOR)

An exclusive union (XOR) is a union where exactly one option must match. Unlike regular unions that succeed when any option matches, `z.xor()` fails if zero options match OR if multiple options match.

```ts
const schema = z.xor([z.string(), z.number()]);

schema.parse("hello"); // ✅ passes
schema.parse(42);      // ✅ passes
schema.parse(true);    // ❌ fails (zero matches)
```

This is useful when you want to ensure mutual exclusivity between options:

```ts
// Validate that exactly ONE of these matches
const payment = z.xor([
  z.object({ type: z.literal("card"), cardNumber: z.string() }),
  z.object({ type: z.literal("bank"), accountNumber: z.string() }),
]);

payment.parse({ type: "card", cardNumber: "1234" }); // ✅ passes
```

If the input could match multiple options, `z.xor()` will fail:

```ts
const overlapping = z.xor([z.string(), z.any()]);
overlapping.parse("hello"); // ❌ fails (matches both string and any)
```


## Discriminated unions

A [discriminated union](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions) is a special kind of union in which a) all the options are object schemas that b) share a particular key (the "discriminator"). Based on the value of the discriminator key, TypeScript is able to "narrow" the type signature as you'd expect.

```ts
type MyResult =
  | { status: "success"; data: string }
  | { status: "failed"; error: string };

function handleResult(result: MyResult){
  if(result.status === "success"){
    result.data; // string
  } else {
    result.error; // string
  }
}
```

You could represent it with a regular `z.union()`. But regular unions are *naive*—they check the input against each option in order and return the first one that passes. This can be slow for large unions.

So Zod provides a `z.discriminatedUnion()` API that uses a *discriminator key* to make parsing more efficient.


```ts
const MyResult = z.discriminatedUnion("status", [
  z.object({ status: z.literal("success"), data: z.string() }),
  z.object({ status: z.literal("failed"), error: z.string() }),
]);
```

Each option should be an *object schema* whose discriminator prop (`status` in the example above) corresponds to some literal value or set of values, usually `z.enum()`, `z.literal()`, `z.null()`, or `z.undefined()`.

<Accordions type="single">
<Accordion title="Nesting discriminated unions">

  For advanced use cases, discriminated unions can be nested. Zod will figure out the optimal parsing strategy to leverage the discriminators at each level.

  ```ts
  const BaseError = { status: z.literal("failed"), message: z.string() };
  const MyErrors = z.discriminatedUnion("code", [
    z.object({ ...BaseError, code: z.literal(400) }),
    z.object({ ...BaseError, code: z.literal(401) }),
    z.object({ ...BaseError, code: z.literal(500) }),
  ]);

  const MyResult = z.discriminatedUnion("status", [
    z.object({ status: z.literal("success"), data: z.string() }),
    MyErrors
  ]);
  ```

</Accordion>
</Accordions>


## Intersections

Intersection types (`A & B`) represent a logical "AND". 

```ts
const a = z.union([z.number(), z.string()]);
const b = z.union([z.number(), z.boolean()]);
const c = z.intersection(a, b);

type c = z.infer<typeof c>; // => number
```

This can be useful for intersecting two object types. 

```ts
const Person = z.object({ name: z.string() });
type Person = z.infer<typeof Person>;

const Employee = z.object({ role: z.string() });
type Employee = z.infer<typeof Employee>;

const EmployedPerson = z.intersection(Person, Employee);
type EmployedPerson = z.infer<typeof EmployedPerson>;
// Person & Employee
```

<Callout type="warn">
  When merging object schemas, prefer [`A.extend(B)`](#extend) over intersections. Using `.extend()` will give you a new object schema, whereas `z.intersection(A, B)` returns a `ZodIntersection` instance which lacks common object methods like `pick` and `omit`.
</Callout>

## Records

Record schemas are used to validate types such as `Record<string, string>`.

### `z.record`

```ts
const IdCache = z.record(z.string(), z.string());
type IdCache = z.infer<typeof IdCache>; // Record<string, string>

IdCache.parse({
  carlotta: "77d2586b-9e8e-4ecf-8b21-ea7e0530eadd",
  jimmie: "77d2586b-9e8e-4ecf-8b21-ea7e0530eadd",
});
```

The key schema can be any Zod schema that is assignable to `string | number | symbol`.

```ts
const Keys = z.union([z.string(), z.number(), z.symbol()]);
const AnyObject = z.record(Keys, z.unknown());
// Record<string | number | symbol, unknown>
```

To create an object schemas containing keys defined by an enum:

```ts
const Keys = z.enum(["id", "name", "email"]);
const Person = z.record(Keys, z.string());
// { id: string; name: string; email: string }
```

Zod supports numeric keys inside records in a way that closely mirrors TypeScript itself. A `number` schema, when used as a record key, will validate that the key is a valid "numeric string". Additional numerical constraints (min, max, step, etc.) will also be validated.

```ts
const numberKeys = z.record(z.number(), z.string());
numberKeys.parse({ 
  1: "one", // ✅
  2: "two", // ✅
  "1.5": "one", // ✅
  "-3": "two", // ✅
  abc: "one" // ❌
});

// further validation is also supported
const intKeys = z.record(z.int().step(1).min(0).max(10), z.string());
intKeys.parse({ 
  0: "zero", // ✅
  1: "one", // ✅
  2: "two", // ✅
  12: "twelve", // ❌
  abc: "one" // ❌
});
```

### `z.partialRecord`


<Callout>
  If you pass a `z.enum` as the first argument to `z.record()`, Zod will exhaustively check that all enum values exist in the input as keys. This behavior agrees with TypeScript:

  ```ts
  type MyRecord = Record<"a" | "b", string>;
  const myRecord: MyRecord = { a: "foo", b: "bar" }; // ✅
  const myRecord: MyRecord = { a: "foo" }; // ❌ missing required key `b`
  ```

  For partial key sets, use `z.partialRecord()`.

</Callout>

If you want a *partial* record type, use `z.partialRecord()`. This skips the special exhaustiveness checks Zod normally runs with `z.enum()` and `z.literal()` key schemas.

```ts
const Keys = z.enum(["id", "name", "email"]).or(z.never()); 
const Person = z.partialRecord(Keys, z.string());
// { id?: string; name?: string; email?: string }
```

### `z.looseRecord`

By default, `z.record()` errors on keys that don't match the key schema. Use `z.looseRecord()` to pass through non-matching keys unchanged. This is particularly useful when combined with intersections to model multiple pattern properties:

```ts
const schema = z
  .object({ name: z.string() })
  .and(z.looseRecord(z.string().regex(/_phone$/), z.e164()));

type schema = z.infer<typeof schema>;
// => { name: string } & Record<string, string>

schema.parse({ 
  name: "John",
  home_phone: "+12345678900",     // validated as phone number
  work_phone: "+12345678900",     // validated as phone number
});
```


## Maps

```ts
const StringNumberMap = z.map(z.string(), z.number());
type StringNumberMap = z.infer<typeof StringNumberMap>; // Map<string, number>

const myMap: StringNumberMap = new Map();
myMap.set("one", 1);
myMap.set("two", 2);

StringNumberMap.parse(myMap);
```

## Sets

```ts
const NumberSet = z.set(z.number());
type NumberSet = z.infer<typeof NumberSet>; // Set<number>

const mySet: NumberSet = new Set();
mySet.add(1);
mySet.add(2);
NumberSet.parse(mySet);
```

Set schemas can be further constrained with the following utility methods.

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
z.set(z.string()).min(5); // must contain 5 or more items
z.set(z.string()).max(5); // must contain 5 or fewer items
z.set(z.string()).size(5); // must contain 5 items exactly
```
</Tab>
<Tab value='Zod Mini'>
```ts
z.set(z.string()).check(z.minSize(5)); // must contain 5 or more items
z.set(z.string()).check(z.maxSize(5)); // must contain 5 or fewer items
z.set(z.string()).check(z.size(5)); // must contain 5 items exactly
```
</Tab>
</Tabs>

## Files

To validate `File` instances:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const fileSchema = z.file();

fileSchema.min(10_000); // minimum .size (bytes)
fileSchema.max(1_000_000); // maximum .size (bytes)
fileSchema.mime("image/png"); // MIME type
fileSchema.mime(["image/png", "image/jpeg"]); // multiple MIME types
```

</Tab>
<Tab value='Zod Mini'>
```ts
const fileSchema = z.file();

fileSchema.check(z.minSize(10_000)); // minimum .size (bytes)
fileSchema.check(z.maxSize(1_000_000)); // maximum .size (bytes)
fileSchema.check(z.mime("image/png")); // MIME type
fileSchema.check(z.mime(["image/png", "image/jpeg"])); // multiple MIME types
```
</Tab>
</Tabs>

## Promises

<Callout type="warn">
  **Deprecated** — `z.promise()` is deprecated. There are vanishingly few valid uses cases for a `Promise` schema. If you suspect a value might be a `Promise`, simply `await` it before parsing it with Zod.
</Callout>

<Accordions type="single"><Accordion title="See z.promise() documentation">

```ts
const numberPromise = z.promise(z.number());
```

"Parsing" works a little differently with promise schemas. Validation happens in two parts:

1. Zod synchronously checks that the input is an instance of Promise (i.e. an object with `.then` and `.catch` methods.).
2. Zod uses `.then` to attach an additional validation step onto the existing Promise. You'll have to use `.catch` on the returned Promise to handle validation failures.

```ts
numberPromise.parse("tuna");
// ZodError: Non-Promise type: string

numberPromise.parse(Promise.resolve("tuna"));
// => Promise<number>

const test = async () => {
  await numberPromise.parse(Promise.resolve("tuna"));
  // ZodError: Non-number type: string

  await numberPromise.parse(Promise.resolve(3.14));
  // => 3.14
};
```

</Accordion></Accordions>

## Instanceof

You can use `z.instanceof` to check that the input is an instance of a class. This is useful to validate inputs against classes that are exported from third-party libraries.

```ts
class Test {
  name: string;
}

const TestSchema = z.instanceof(Test);

TestSchema.parse(new Test()); // ✅
TestSchema.parse("whatever"); // ❌
```

### Property

To validate a particular property of a class instance against a Zod schema:

```ts
const blobSchema = z.instanceof(URL).check(
  z.property("protocol", z.literal("https:" as string, "Only HTTPS allowed"))
);

blobSchema.parse(new URL("https://example.com")); // ✅
blobSchema.parse(new URL("http://example.com")); // ❌
```

The `z.property()` API works with any data type (but it's most useful when used in conjunction with `z.instanceof()`).

```ts
const blobSchema = z.string().check(
  z.property("length", z.number().min(10))
);

blobSchema.parse("hello there!"); // ✅
blobSchema.parse("hello."); // ❌
```

## Refinements

Every Zod schema stores an array of *refinements*. Refinements are a way to perform custom validation that Zod doesn't provide a native API for.

### `.refine()`

{/* <Callout>
  Checks do not (in fact, cannot) change the inferred type of the schema.
</Callout>

### `.refine()` */}

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const myString = z.string().refine((val) => val.length <= 255);
```
</Tab>
<Tab value="Zod Mini">
```ts
const myString = z.string().check(z.refine((val) => val.length <= 255));
```
</Tab>
</Tabs>

<Callout type="warn">
  Refinement functions should never throw. Instead they should return a falsy value to signal failure. Thrown errors are not caught by Zod.
</Callout>

#### `error` 

To customize the error message:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const myString = z.string().refine((val) => val.length > 8, { 
  error: "Too short!" 
});
```
</Tab>
<Tab value="Zod Mini">
```ts
const myString = z.string().check(
  z.refine((val) => val.length > 8, { error: "Too short!" })
);
```
</Tab>
</Tabs>

#### `abort` 

By default, validation issues from checks are considered *continuable*; that is, Zod will execute *all* checks in sequence, even if one of them causes a validation error. This is usually desirable, as it means Zod can surface as many errors as possible in one go.

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const myString = z.string()
  .refine((val) => val.length > 8, { error: "Too short!" })
  .refine((val) => val === val.toLowerCase(), { error: "Must be lowercase" });
  

const result = myString.safeParse("OH NO");
result.error?.issues;
/* [
  { "code": "custom", "message": "Too short!" },
  { "code": "custom", "message": "Must be lowercase" }
] */
```
</Tab>
<Tab value="Zod Mini">
```ts
const myString = z.string().check(
  z.refine((val) => val.length > 8, { error: "Too short!" }),
  z.refine((val) => val === val.toLowerCase(), { error: "Must be lowercase" })
);

const result = z.safeParse(myString, "OH NO");
result.error?.issues;
/* [
  { "code": "custom", "message": "Too short!" },
  { "code": "custom", "message": "Must be lowercase" }
] */
```
</Tab>
</Tabs>


To mark a particular refinement as *non-continuable*, use the `abort` parameter. Validation will terminate if the check fails.

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const myString = z.string()
  .refine((val) => val.length > 8, { error: "Too short!", abort: true })
  .refine((val) => val === val.toLowerCase(), { error: "Must be lowercase", abort: true });


const result = myString.safeParse("OH NO");
result.error?.issues;
// => [{ "code": "custom", "message": "Too short!" }]
```
</Tab>
<Tab value="Zod Mini">
```ts
const myString = z.string().check(
  z.refine((val) => val.length > 8, { error: "Too short!", abort: true }),
  z.refine((val) => val === val.toLowerCase(), { error: "Must be lowercase", abort: true })
);

const result = z.safeParse(myString, "OH NO");
result.error?.issues;
// [ { "code": "custom", "message": "Too short!" }]
```
</Tab>
</Tabs>

#### `path`

To customize the error path, use the `path` parameter. This is typically only useful in the context of object schemas.

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const passwordForm = z
  .object({
    password: z.string(),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    error: "Passwords don't match",
    path: ["confirm"], // path of error
  });
```
</Tab>
<Tab value="Zod Mini">
```ts
const passwordForm = z
  .object({
    password: z.string(),
    confirm: z.string(),
  })
  .check(z.refine((data) => data.password === data.confirm, {
    error: "Passwords don't match",
    path: ["confirm"], // path of error
  }));
```
</Tab>
</Tabs>


This will set the `path` parameter in the associated issue:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const result = passwordForm.safeParse({ password: "asdf", confirm: "qwer" });
result.error.issues;
/* [{
  "code": "custom",
  "path": [ "confirm" ],
  "message": "Passwords don't match"
}] */
```
</Tab>
<Tab value="Zod Mini">
```ts
const result = z.safeParse(passwordForm, { password: "asdf", confirm: "qwer" });
result.error.issues;
/* [{
  "code": "custom",
  "path": [ "confirm" ],
  "message": "Passwords don't match"
}] */
```
</Tab>
</Tabs>

To define an asynchronous refinement, just pass an `async` function:

```ts
const userId = z.string().refine(async (id) => {
  // verify that ID exists in database
  return true;
});
```

<Callout>
  If you use async refinements, you must use the `.parseAsync` method to parse data! Otherwise Zod will throw an error.

  <Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
  <Tab value="Zod">
  ```ts
  const result = await userId.parseAsync("abc123");
  ```
  </Tab>
  <Tab value="Zod Mini">
  ```ts
  const result = await z.parseAsync(userId, "abc123");
  ```
  </Tab>
  </Tabs>
</Callout>

#### `when`

> **Note** — This is a power user feature and can absolutely be abused in ways that will increase the probability of uncaught errors originating from inside your refinements. 

By default, refinements don't run if any *non-continuable* issues have already been encountered. Zod is careful to ensure the type signature of the value is correct before passing it into any refinement functions.

```ts
const schema = z.string().refine((val) => {
  return val.length > 8
});

schema.parse(1234); // invalid_type: refinement won't be executed
```

In some cases, you want finer control over when refinements run. For instance consider this "password confirm" check:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const schema = z
  .object({
    password: z.string().min(8),
    confirmPassword: z.string(),
    anotherField: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

schema.parse({
  password: "asdf",
  confirmPassword: "asdf",
  anotherField: 1234 // ❌ this error will prevent the password check from running
});
```
</Tab>
<Tab value="Zod Mini">
```ts
const schema = z
  .object({
    password: z.string().check(z.minLength(8)),
    confirmPassword: z.string(),
    anotherField: z.string(),
  })
  .check(z.refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  }));

schema.parse({
  password: "asdf",
  confirmPassword: "asdf",
  anotherField: 1234 // ❌ this error will prevent the password check from running
});
```
</Tab>
</Tabs>

An error on `anotherField` will prevent the password confirmation check from executing, even though the check doesn't depend on `anotherField`. To control when a refinement will run, use the `when` parameter:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const baseSchema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string(),
  anotherField: z.string(),
});

const schema = baseSchema
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],

    // run if password & confirmPassword are valid
    when(payload) { // [!code ++]
      return baseSchema // [!code ++]
        .pick({ password: true, confirmPassword: true }) // [!code ++]
        .safeParse(payload.value).success; // [!code ++]
    },  // [!code ++]
  });

schema.parse({
  password: "asdf",
  confirmPassword: "asdf",
  anotherField: 1234 // ❌ this error will not prevent the password check from running
});
```
</Tab>
<Tab value="Zod Mini">
```ts
const schema = z
  .object({
    password: z.string().min(8),
    confirmPassword: z.string(),
    anotherField: z.string(),
  })
  .check(z.refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],

    when(payload) { // [!code ++]
      // no issues with `password` or `confirmPassword` // [!code ++]
      return payload.issues.every((iss) => { // [!code ++]
        const firstPathEl = iss.path?.[0]; // [!code ++]
        return firstPathEl !== "password" && firstPathEl !== "confirmPassword"; // [!code ++]
      }); // [!code ++]
    },  // [!code ++]
  }));

schema.parse({
  password: "asdf",
  confirmPassword: "asdf",
  anotherField: 1234 // ❌ this error will prevent the password check from running
});
```
</Tab>
</Tabs>


### `.superRefine()`
    

The regular `.refine` API only generates a single issue with a `"custom"` error code, but `.superRefine()` makes it possible to create multiple issues using any of Zod's [internal issue types](https://github.com/colinhacks/zod/blob/main/packages/zod/src/v4/core/errors.ts).

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const UniqueStringArray = z.array(z.string()).superRefine((val, ctx) => {
  if (val.length > 3) {
    ctx.addIssue({
      code: "too_big",
      maximum: 3,
      origin: "array",
      inclusive: true,
      message: "Too many items 😡",
      input: val,
    });
  }

  if (val.length !== new Set(val).size) {
    ctx.addIssue({
      code: "custom",
      message: `No duplicates allowed.`,
      input: val,
    });
  }
});


```
</Tab>
<Tab value="Zod Mini">
```ts
const UniqueStringArray = z.array(z.string()).check(
  z.superRefine((val, ctx) => {
    if (val.length > 3) {
      ctx.addIssue({
        code: "too_big",
        maximum: 3,
        origin: "array",
        inclusive: true,
        message: "Too many items 😡",
        input: val,
      });
    }

    if (val.length !== new Set(val).size) {
      ctx.addIssue({
        code: "custom",
        message: `No duplicates allowed.`,
        input: val,
      });
    }
  })
);
```
</Tab>
</Tabs>

### `.check()`

<Callout>
**Note** — The `.check()` API is a more low-level API that's generally more complex than `.superRefine()`. It can be faster in performance-sensitive code paths, but it's also more verbose.
</Callout>

<Accordions>
<Accordion title="View example">
The `.refine()` API is syntactic sugar atop a more versatile (and verbose) API called `.check()`. You can use this API to create multiple issues in a single refinement or have full control of the generated issue objects.

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const UniqueStringArray = z.array(z.string()).check((ctx) => {
  if (ctx.value.length > 3) {
    // full control of issue objects
    ctx.issues.push({
      code: "too_big",
      maximum: 3,
      origin: "array",
      inclusive: true,
      message: "Too many items 😡",
      input: ctx.value
    });
  }

  // create multiple issues in one refinement
  if (ctx.value.length !== new Set(ctx.value).size) {
    ctx.issues.push({
      code: "custom",
      message: `No duplicates allowed.`,
      input: ctx.value,
      continue: true // make this issue continuable (default: false)
    });
  }
});
```
</Tab>
<Tab value="Zod Mini">
```ts
const UniqueStringArray = z.array(z.string()).check((ctx) => {
  // full control of issue objects
  if (ctx.value.length > 3) {
    ctx.issues.push({
      code: "too_big",
      maximum: 3,
      origin: "array",
      inclusive: true,
      message: "Too many items 😡",
      input: ctx.value
    });
  }

// create multiple issues in one refinement
  if (ctx.value.length !== new Set(ctx.value).size) {
    ctx.issues.push({
      code: "custom",
      message: `No duplicates allowed.`,
      input: ctx.value,
      continue: true // make this issue continuable (default: false)
    });
  }
});
```
</Tab>
</Tabs>
</Accordion>
</Accordions>

## Codecs

> Introduced in `zod@4.1`. Refer to the dedicated [Codecs](/codecs) page for more information.

Codecs are a special kind of schema that implement *bidirectional transformations* between two other schemas.

```ts
const stringToDate = z.codec(
  z.iso.datetime(),  // input schema: ISO date string
  z.date(),          // output schema: Date object
  {
    decode: (isoString) => new Date(isoString), // ISO string → Date
    encode: (date) => date.toISOString(),       // Date → ISO string
  }
);
```

A regular `.parse()` operations performs the *forward transform*. It calls the codec's `decode` function.

```ts
stringToDate.parse("2024-01-15T10:30:00.000Z"); // => Date
```

You can alternatively use the top-level `z.decode()` function. Unlike `.parse()` (which accepts `unknown` input), `z.decode()` expects a strongly-typed input (`string` in this example).

```ts
z.decode(stringToDate, "2024-01-15T10:30:00.000Z"); // => Date
```

To perform the *reverse transform*, use the inverse: `z.encode()`.

```ts
z.encode(stringToDate, new Date("2024-01-15")); // => "2024-01-15T00:00:00.000Z"
```

Use `z.invertCodec()` to derive a new codec with the input and output schemas swapped.

```ts
const dateToString = z.invertCodec(stringToDate);

z.decode(dateToString, new Date("2024-01-15")); // => string
z.encode(dateToString, "2024-01-15T00:00:00.000Z"); // => Date
```

Refer to the dedicated [Codecs](/codecs) page for more information. That page contains implementations for commonly-needed codecs that you can copy/paste into your project:

- [**`stringToNumber`**](/codecs#stringtonumber)
- [**`stringToInt`**](/codecs#stringtoint)
- [**`stringToBigInt`**](/codecs#stringtobigint)
- [**`numberToBigInt`**](/codecs#numbertobigint)
- [**`isoDatetimeToDate`**](/codecs#isodatetimetodate)
- [**`epochSecondsToDate`**](/codecs#epochsecondstodate)
- [**`epochMillisToDate`**](/codecs#epochmillistodate)
- [**`jsonCodec`**](/codecs#jsoncodec)
- [**`utf8ToBytes`**](/codecs#utf8tobytes)
- [**`bytesToUtf8`**](/codecs#bytestoutf8)
- [**`base64ToBytes`**](/codecs#base64tobytes)
- [**`base64urlToBytes`**](/codecs#base64urltobytes)
- [**`hexToBytes`**](/codecs#hextobytes)
- [**`stringToURL`**](/codecs#stringtourl)
- [**`stringToHttpURL`**](/codecs#stringtohttpurl)
- [**`uriComponent`**](/codecs#uricomponent)
- [**`stringToBoolean`**](/codecs#stringtoboolean)

## Pipes

Schemas can be chained together into "pipes". Pipes are primarily useful when used in conjunction with [Transforms](#transforms).

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const stringToLength = z.string().pipe(z.transform(val => val.length));

stringToLength.parse("hello"); // => 5
```
</Tab>
<Tab value="Zod Mini">
```ts
const stringToLength = z.pipe(z.string(), z.transform(val => val.length));

z.parse(stringToLength, "hello"); // => 5
```
</Tab>
</Tabs>


## Transforms

> **Note** — For bi-directional transforms, use [codecs](/codecs).

Transforms are a special kind of schema that perform a unidirectional transformation. Instead of validating input, they accept anything and perform some transformation on the data. To define a transform:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const castToString = z.transform((val) => String(val));

castToString.parse("asdf"); // => "asdf"
castToString.parse(123); // => "123"
castToString.parse(true); // => "true"
```
</Tab>
<Tab value="Zod Mini">
```ts
const castToString = z.transform((val) => String(val));

z.parse(castToString, "asdf"); // => "asdf"
z.parse(castToString, 123); // => "123"
z.parse(castToString, true); // => "true"
```
</Tab>
</Tabs>

<Callout type="warn">
  Transform functions should never throw. Thrown errors are not caught by Zod.
</Callout>

{/* The output type of the schema is inferred from the transform function:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const castToString = z.transform((val) => String(val));

type CastToString = z.infer<typeof castToString>; // string
```
</Tab>
<Tab value="Zod Mini">
```ts
const castToString = z.transform((val) => String(val));

type CastToString = z.infer<typeof castToString>; // string
```
</Tab>
</Tabs> */}


To perform validation logic inside a transform, use `ctx`. To report a validation issue, push a new issue onto `ctx.issues` (similar to the [`.check()`](#check) API).

```ts
const coercedInt = z.transform((val, ctx) => {
  try {
    const parsed = Number.parseInt(String(val));
    return parsed;
  } catch (e) {
    ctx.issues.push({
      code: "custom",
      message: "Not a number",
      input: val,
    });

    // this is a special constant with type `never`
    // returning it lets you exit the transform without impacting the inferred return type
    return z.NEVER;
  }
});
```

Most commonly, transforms are used in conjunction with [Pipes](#pipes). This combination is useful for performing some initial validation, then transforming the parsed data into another form.


<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const stringToLength = z.string().pipe(z.transform(val => val.length));

stringToLength.parse("hello"); // => 5
```
</Tab>
<Tab value="Zod Mini">
```ts
const stringToLength = z.pipe(z.string(), z.transform(val => val.length));

z.parse(stringToLength, "hello"); // => 5
```
</Tab>
</Tabs>

### `.transform()`

Piping some schema into a transform is a common pattern, so Zod provides a convenience `.transform()` method.

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const stringToLength = z.string().transform(val => val.length); 
```
</Tab>
<Tab value="Zod Mini">
```ts
// no equivalent
```
</Tab>
</Tabs>

Transforms can also be async:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const idToUser = z
  .string()
  .transform(async (id) => {
    // fetch user from database
    return db.getUserById(id); 
  });

const user = await idToUser.parseAsync("abc123");
```
</Tab>
<Tab value="Zod Mini">
```ts
const idToUser = z.pipe(
  z.string(),
  z.transform(async (id) => {
    // fetch user from database
    return db.getUserById(id); 
  }));

const user = await idToUser.parse("abc123");
```
</Tab>
</Tabs>

<Callout>
  If you use async transforms, you must use a `.parseAsync` or `.safeParseAsync` when parsing data! Otherwise Zod will throw an error.
</Callout>

### `.preprocess()` 

Piping a transform into another schema is another common pattern, so Zod provides a convenience `z.preprocess()` function.

```ts
const coercedInt = z.preprocess((val) => {
  if (typeof val === "string") {
    return Number.parseInt(val);
  }
  return val;
}, z.int());
```

By default, the input type of a `z.preprocess()` schema is `unknown`, since the preprocessor is expected to handle arbitrary input. To narrow the input type, annotate the preprocessor's parameter directly:

```ts
const trimmed = z.preprocess(
  (val: string | null | undefined) => val?.trim() ?? "",
  z.string()
);

type Input = z.input<typeof trimmed>;  // string | null | undefined
type Output = z.output<typeof trimmed>; // string
```

This is useful when integrating with libraries like `react-hook-form` that derive their form value type from `z.input<>`.

## Defaults

To set a default value for a schema:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const defaultTuna = z.string().default("tuna");

defaultTuna.parse(undefined); // => "tuna"
```
</Tab>
<Tab value="Zod Mini">
```ts
const defaultTuna = z._default(z.string(), "tuna");

defaultTuna.parse(undefined); // => "tuna"
```
</Tab>
</Tabs>

Alternatively, you can pass a function which will be re-executed whenever a default value needs to be generated:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const randomDefault = z.number().default(Math.random);

randomDefault.parse(undefined);    // => 0.4413456736055323
randomDefault.parse(undefined);    // => 0.1871840107401901
randomDefault.parse(undefined);    // => 0.7223408162401552
```
</Tab>
<Tab value="Zod Mini">
```ts
const randomDefault = z._default(z.number(), Math.random);

z.parse(randomDefault, undefined); // => 0.4413456736055323
z.parse(randomDefault, undefined); // => 0.1871840107401901
z.parse(randomDefault, undefined); // => 0.7223408162401552
```
</Tab>
</Tabs>


## Prefaults

In Zod, setting a *default* value will short-circuit the parsing process. If the input is `undefined`, the default value is eagerly returned. As such, the default value must be assignable to the *output type* of the schema.

```ts
const schema = z.string().transform(val => val.length).default(0);
schema.parse(undefined); // => 0
```

Sometimes, it's useful to define a *prefault* ("pre-parse default") value. If the input is `undefined`, the prefault value will be parsed instead. The parsing process is *not* short circuited. As such, the prefault value must be assignable to the *input type* of the schema.

```ts
z.string().transform(val => val.length).prefault("tuna");
schema.parse(undefined); // => 4
```

This is also useful if you want to pass some input value through some mutating refinements.

```ts
const a = z.string().trim().toUpperCase().prefault("  tuna  ");
a.parse(undefined); // => "TUNA"

const b = z.string().trim().toUpperCase().default("  tuna  ");
b.parse(undefined); // => "  tuna  "
```

## Catch

Use `.catch()` to define a fallback value to be returned in the event of a validation error:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const numberWithCatch = z.number().catch(42);

numberWithCatch.parse(5); // => 5
numberWithCatch.parse("tuna"); // => 42
```
</Tab>
<Tab value="Zod Mini">
```ts
const numberWithCatch = z.catch(z.number(), 42);

numberWithCatch.parse(5); // => 5
numberWithCatch.parse("tuna"); // => 42
```
</Tab>
</Tabs>


Alternatively, you can pass a function which will be re-executed whenever a catch value needs to be generated.

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const numberWithRandomCatch = z.number().catch((ctx) => {
  ctx.error; // the caught ZodError

  return Math.random();
});

numberWithRandomCatch.parse("sup"); // => 0.4413456736055323
numberWithRandomCatch.parse("sup"); // => 0.1871840107401901
numberWithRandomCatch.parse("sup"); // => 0.7223408162401552
```
</Tab>
<Tab value="Zod Mini">
```ts
const numberWithRandomCatch = z.catch(z.number(), (ctx) => {
  ctx.value;   // the input value
  ctx.issues;  // the caught validation issue
  return Math.random();
});

z.parse(numberWithRandomCatch, "sup"); // => 0.4413456736055323
z.parse(numberWithRandomCatch, "sup"); // => 0.1871840107401901
z.parse(numberWithRandomCatch, "sup"); // => 0.7223408162401552
```
</Tab>
</Tabs>

## Branded types

TypeScript's type system is [structural](https://www.typescriptlang.org/docs/handbook/type-compatibility.html), meaning that two types that are structurally equivalent are considered the same.

```ts
type Cat = { name: string };
type Dog = { name: string };

const pluto: Dog = { name: "pluto" };
const simba: Cat = pluto; // works fine
```

In some cases, it can be desirable to simulate [nominal typing](https://en.wikipedia.org/wiki/Nominal_type_system) inside TypeScript. This can be achieved with *branded types* (also known as "opaque types").

```ts
const Cat = z.object({ name: z.string() }).brand<"Cat">();
const Dog = z.object({ name: z.string() }).brand<"Dog">();

type Cat = z.infer<typeof Cat>; // { name: string } & z.$brand<"Cat">
type Dog = z.infer<typeof Dog>; // { name: string } & z.$brand<"Dog">

const pluto = Dog.parse({ name: "pluto" });
const simba: Cat = pluto; // ❌ not allowed
```

Under the hood, this works by attaching a "brand" to the schema's inferred type.

```ts
const Cat = z.object({ name: z.string() }).brand<"Cat">();
type Cat = z.output<typeof Cat>; // { name: string } & z.$brand<"Cat">
```

With this brand, plain (unbranded) data structures are not assignable to the inferred type. You have to parse some data with the schema to get branded data.

> Note that branded types do not affect the runtime result of `.parse`. It is a static-only construct.

By default, only the *output type* is branded. 

```ts
const USD = z.string().brand<"USD">();

type USDOutput = z.output<typeof USD>; // string & z.$brand<"USD">
type USDInput = z.input<typeof USD>; // string
```

To customize this, pass a second generic to `.brand()` to specify the direction of the brand.

```ts
// requires Zod 4.2+
z.string().brand<"Cat", "out">(); // output is branded (default)
z.string().brand<"Cat", "in">(); // input is branded
z.string().brand<"Cat", "inout">(); // both are branded
```

## Readonly

To mark a schema as readonly:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const ReadonlyUser = z.object({ name: z.string() }).readonly();
type ReadonlyUser = z.infer<typeof ReadonlyUser>;
// Readonly<{ name: string }>
```
</Tab>
<Tab value="Zod Mini">
```ts
const ReadonlyUser = z.readonly(z.object({ name: z.string() }));
type ReadonlyUser = z.infer<typeof ReadonlyUser>;
// Readonly<{ name: string }>
```
</Tab>
</Tabs>

The inferred type is marked as `readonly`. Note that in TypeScript, this only affects objects, arrays, tuples, `Set`, and `Map`:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
z.object({ name: z.string() }).readonly(); // { readonly name: string }
z.array(z.string()).readonly(); // readonly string[]
z.tuple([z.string(), z.number()]).readonly(); // readonly [string, number]
z.map(z.string(), z.date()).readonly(); // ReadonlyMap<string, Date>
z.set(z.string()).readonly(); // ReadonlySet<string>
```
</Tab>
<Tab value="Zod Mini">
```ts
z.readonly(z.object({ name: z.string() })); // { readonly name: string }
z.readonly(z.array(z.string())); // readonly string[]
z.readonly(z.tuple([z.string(), z.number()])); // readonly [string, number]
z.readonly(z.map(z.string(), z.date())); // ReadonlyMap<string, Date>
z.readonly(z.set(z.string())); // ReadonlySet<string>
```
</Tab>
</Tabs>

Inputs will be parsed like normal, then the result will be frozen with [`Object.freeze()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze) to prevent modifications.

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const result = ReadonlyUser.parse({ name: "fido" });
result.name = "simba"; // throws TypeError
```
</Tab>
<Tab value="Zod Mini">
```ts
const result = z.parse(ReadonlyUser, { name: "fido" });
result.name = "simba"; // throws TypeError
```
</Tab>
</Tabs>

## JSON

To validate any JSON-encodable value:

```ts
const jsonSchema = z.json();
```

This is a convenience API that returns the following union schema:

```ts
const jsonSchema = z.lazy(() => {
  return z.union([
    z.string(params), 
    z.number(), 
    z.boolean(), 
    z.null(), 
    z.array(jsonSchema), 
    z.record(z.string(), jsonSchema)
  ]);
});
```



## Functions

Zod provides a `z.function()` utility for defining Zod-validated functions. This way, you can avoid intermixing validation code with your business logic.

```ts
const MyFunction = z.function({
  input: [z.string()], // parameters (must be an array or a ZodTuple)
  output: z.number()  // return type
});

type MyFunction = z.infer<typeof MyFunction>;
// (input: string) => number
```

Function schemas have an `.implement()` method which accepts a function and returns a new function that automatically validates its inputs and outputs.

```ts
const computeTrimmedLength = MyFunction.implement((input) => {
  // TypeScript knows input is a string!
  return input.trim().length;
});

computeTrimmedLength("sandwich"); // => 8
computeTrimmedLength(" asdf "); // => 4
```

This function will throw a `ZodError` if the input is invalid:

```ts
computeTrimmedLength(42); // throws ZodError
```

If you only care about validating inputs, you can omit the `output` field.

```ts
const MyFunction = z.function({
  input: [z.string()], // parameters (must be an array or a ZodTuple)
});

const computeTrimmedLength = MyFunction.implement((input) => input.trim.length);
```


Use the `.implementAsync()` method to create an async function.

```ts
const computeTrimmedLengthAsync = MyFunction.implementAsync(
  async (input) => input.trim().length
);

computeTrimmedLengthAsync("sandwich"); // => Promise<8>
```

## Custom

You can create a Zod schema for any TypeScript type by using `z.custom()`. This is useful for validating types from third-party libraries or any other type that isn't covered by a built-in schema. For class instances, prefer [`z.instanceof()`](#instanceof); for template literal types, prefer [`z.templateLiteral()`](#template-literals).

```ts
import { Decimal } from "decimal.js";

const decimalSchema = z.custom<Decimal>((val) => Decimal.isDecimal(val));

decimalSchema.parse(new Decimal("1.5")); // passes
decimalSchema.parse("1.5");              // throws
```

If you don't provide a validation function, Zod will allow any value. This can be dangerous!

```ts
z.custom<{ arg: string }>(); // performs no validation
```

You can customize the error message and other options by passing a second argument. This parameter works the same way as the params parameter of [`.refine`](#refine).

```ts
z.custom<...>((val) => ..., "custom error message");
```

## Apply

Use `.apply()` to incorporate external functions into Zod's method chain:

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
function setCommonNumberChecks<T extends z.ZodNumber>(schema: T) {
  return schema
    .min(0)
    .max(100);
}

const schema = z.number()
  .apply(setCommonNumberChecks)
  .nullable();

schema.parse(0);  // => 0
schema.parse(-1); // ❌ throws
schema.parse(101); // ❌ throws
schema.parse(null); // => null
```
</Tab>
<Tab value="Zod Mini">
```ts
function setCommonNumberChecks<T extends z.ZodMiniNumber>(schema: T) {
  return schema.check(
    z.minimum(0), z.maximum(100)
  );
}

const schema = z.nullable(
  z.number().apply(setCommonNumberChecks)
);

z.parse(schema, 0);   // => 0
z.parse(schema, -1);  // ❌ throws
z.parse(schema, 101); // ❌ throws
z.parse(schema, null); // => null
```
</Tab>
</Tabs>
