---
title: Codecs
description: "Bidirectional transformations with encode and decode"
---

import { Tabs, Tab } from 'fumadocs-ui/components/tabs';
import { ThemedImage } from "@/components/themed-image";

> Introduced in `zod@4.1`.

All Zod schemas can process inputs in both the forward and backward direction: 

- **Forward**: `Input` to `Output`
  - `.parse()`
  - `.decode()`
- **Backward**: `Output` to `Input`
  - `.encode()`

In most cases, this is a distinction without a difference. The input and output types are identical, so there's no difference between "forward" and "backward".

<Tabs groupId="lib" items={["Zod", "Zod Mini"]}>
<Tab value="Zod">
```ts
const schema = z.string();

type Input = z.input<typeof schema>;    // string
type Output = z.output<typeof schema>;  // string

schema.parse("asdf");   // => "asdf"
schema.decode("asdf");  // => "asdf"
schema.encode("asdf");  // => "asdf"
```
</Tab>
<Tab value="Zod Mini">
```ts
const schema = z.string();

type Input = z.input<typeof schema>;    // string
type Output = z.output<typeof schema>;  // string

z.parse(schema, "asdf");   // => "asdf"
z.decode(schema, "asdf");  // => "asdf"
z.encode(schema, "asdf");  // => "asdf"
```
</Tab>
</Tabs>


However, some schema types cause the input and output types to diverge, notably `z.codec()`. Codecs are a special type of schema that defines a *bi-directional transformation* between two other schemas.

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

In these cases, `z.decode()` and `z.encode()` behave quite differently.

<Tabs items={['Zod', 'Zod Mini']}>
<Tab value="Zod">
```ts
stringToDate.decode("2024-01-15T10:30:00.000Z")
// => Date

stringToDate.encode(new Date("2024-01-15T10:30:00.000Z"))
// => string
```
</Tab>
<Tab value="Zod Mini">
```ts
z.decode(stringToDate, "2024-01-15T10:30:00.000Z")
// => Date

z.encode(stringToDate, new Date("2024-01-15T10:30:00.000Z"))
// => string
```
</Tab>
</Tabs>

> **Note** —There's nothing special about the directions or terminology here. Instead of *encoding* with an `A -> B` codec, you could instead *decode* with a `B -> A` codec. The use of the terms "decode" and "encode" is just a convention.

This is particularly useful when parsing data at a network boundary. You can share a single Zod schema between your client and server, then use this single schema to convert between a network-friendly format (say, JSON) and a richer JavaScript representation.

<ThemedImage 
  lightSrc="/codecs/codecs-network-light.svg" 
  darkSrc="/codecs/codecs-network-dark.svg" 
  alt="Codecs encoding and decoding data across a network boundary" 
/>

### Inverting codecs

Use `z.invertCodec()` to derive the reverse codec from an existing one. The returned codec swaps the input and output schemas, then swaps the `decode` and `encode` transforms.

<Tabs items={['Zod', 'Zod Mini']}>
<Tab value="Zod">
```ts
const dateToString = z.invertCodec(stringToDate);

dateToString.decode(new Date("2024-01-15T10:30:00.000Z"));
// => string

dateToString.encode("2024-01-15T10:30:00.000Z");
// => Date
```
</Tab>
<Tab value="Zod Mini">
```ts
const dateToString = z.invertCodec(stringToDate);

z.decode(dateToString, new Date("2024-01-15T10:30:00.000Z"));
// => string

z.encode(dateToString, "2024-01-15T10:30:00.000Z");
// => Date
```
</Tab>
</Tabs>

`z.invertCodec()` only inverts the codec you pass to it. It does not recursively invert codecs nested inside another schema; invert those codecs where you define the reversed schema.

### Composability

> **Note** — You can use `z.encode()` and `z.decode()` with any schema. It doesn't have to be a ZodCodec.

Codecs are a schema like any other. You can nest them inside objects, arrays, pipes, etc. There are no rules on where you can use them!

```ts
const payloadSchema = z.object({ 
  startDate: stringToDate 
});

payloadSchema.decode({
  startDate: "2024-01-15T10:30:00.000Z"
}); // => { startDate: Date }
```


### Type-safe inputs

While `.parse()` and `.decode()` behave identically at *runtime*, they have different type signatures. The `.parse()` method accepts `unknown` as input, and returns a value that matches the schema's inferred *output type*. By contrast, the `z.decode()` and `z.encode()` functions have *strongly-typed inputs*. 

```ts
stringToDate.parse(12345); 
// no complaints from TypeScript (fails at runtime)

stringToDate.decode(12345); 
// ❌ TypeScript error: Argument of type 'number' is not assignable to parameter of type 'string'.

stringToDate.encode(12345); 
// ❌ TypeScript error: Argument of type 'number' is not assignable to parameter of type 'Date'.
```

Why the difference? Encoding and decoding imply *transformation*. In many cases, the inputs to these methods are already strongly typed in application code, so z.decode/z.encode accept strongly typed inputs to surface mistakes at compile time.
Here's a diagram demonstrating the differences between the type signatures for `parse()`, `decode()`, and `encode()`.

<ThemedImage 
  lightSrc="/codecs/codecs-light.png" 
  darkSrc="/codecs/codecs-dark.png" 
  alt="Codec directionality diagram showing bidirectional transformation between input and output schemas" 
/>

### Async and safe variants

As with `.transform()` and `.refine()`, codecs support async transforms.

```ts
const asyncCodec = z.codec(z.string(), z.number(), {
  decode: async (str) => Number(str),
  encode: async (num) => num.toString(),
});
```

As with regular `parse()`, there are "safe" and "async" variants of `decode()` and `encode()`.

```ts
stringToDate.decode("2024-01-15T10:30:00.000Z"); 
// => Date

stringToDate.decodeAsync("2024-01-15T10:30:00.000Z"); 
// => Promise<Date>

stringToDate.safeDecode("2024-01-15T10:30:00.000Z"); 
// => { success: true, data: Date } | { success: false, error: ZodError }

stringToDate.safeDecodeAsync("2024-01-15T10:30:00.000Z"); 
// => Promise<{ success: true, data: Date } | { success: false, error: ZodError }>
```

## How encoding works

There are some subtleties to how certain Zod schemas "reverse" their parse behavior. 

### Codecs

This one is fairly self-explanatory. Codecs encapsulate a bi-directional transformation between two types. `z.decode()` triggers the `decode` transform to convert input into a parsed value, while `z.encode()` triggers the `encode` transform to serialize it back.

```ts
const stringToDate = z.codec(
  z.iso.datetime(),  // input schema: ISO date string
  z.date(),          // output schema: Date object
  {
    decode: (isoString) => new Date(isoString), // ISO string → Date
    encode: (date) => date.toISOString(),       // Date → ISO string
  }
);

stringToDate.decode("2024-01-15T10:30:00.000Z"); 
// => Date

stringToDate.encode(new Date("2024-01-15")); 
// => string
```


### Pipes

> **Fun fact** — Codecs are implemented internally as *subclasses* of pipes with "interstitial" transform logic. 

During regular decoding, a `ZodPipe<A, B>` schema will first parse the data with `A`, then pass it into `B`. As you might expect, during encoding, the data is first encoded with `B`, then passed into `A`.

### Refinements

All checks (`.refine()`, `.min()`, `.max()`, etc.) are still executed in both directions. 

```ts
const schema = stringToDate.refine((date) => date.getFullYear() >= 2000, "Must be this millennium");

schema.encode(new Date("2000-01-01"));
// => Date

schema.encode(new Date("1999-01-01"));
// => ❌ ZodError: [
//   {
//     "code": "custom",
//     "path": [],
//     "message": "Must be this millennium"
//   }
// ]
```

To avoid unexpected errors in your custom `.refine()` logic, Zod performs two "passes" during `z.encode()`. The first pass ensures the input type conforms to the expected type (no `invalid_type` errors). If that passes, Zod performs the second pass which executes the refinement logic.

This approach also supports "mutating transforms" like `z.string().trim()` or `z.string().toLowerCase()`:

```ts
const schema = z.string().trim();

schema.decode("  hello  ");
// => "hello"

schema.encode("  hello  ");
// => "hello"
```

### Defaults and prefaults

Defaults and prefaults are only applied in the "forward" direction. 
```ts
const stringWithDefault = z.string().default("hello");

stringWithDefault.decode(undefined); 
// => "hello"

stringWithDefault.encode(undefined); 
// => ZodError: Expected string, received undefined
```

When you attach a default value to a schema, the input becomes optional (`| undefined`) but the output does not. As such, `undefined` is not a valid input to `z.encode()` and defaults/prefaults will not be applied. 

### Catch

Similarly, `.catch()` is only applied in the "forward" direction.

```ts
const stringWithCatch = z.string().catch("hello");

stringWithCatch.decode(1234); 
// => "hello"

stringWithCatch.encode(1234); 
// => ZodError: Expected string, received number
```

### Stringbool

> **Note** — [Stringbool](/api#stringbool) pre-dates the introduction of codecs in Zod. It has since been internally re-implemented as a codec. 

The `z.stringbool()` API converts string values (`"true"`, `"false"`, `"yes"`, `"no"`, etc.) into `boolean`. By default, it will convert `true` to `"true"` and `false` to `"false"` during `z.encode()`.

```ts
const stringbool = z.stringbool();

stringbool.decode("true");  // => true
stringbool.decode("false"); // => false

stringbool.encode(true);    // => "true"
stringbool.encode(false);   // => "false"
```

If you specify a custom set of `truthy` and `falsy` values, the *first element in the array* will be used instead.

```ts
const stringbool = z.stringbool({ truthy: ["yes", "y"], falsy: ["no", "n"] });

stringbool.encode(true);    // => "yes"
stringbool.encode(false);   // => "no"
```

### Transforms

⚠️ — The `.transform()` API implements a *unidirectional* transformation. If any `.transform()` exists anywhere in your schema, attempting a `z.encode()` operation will throw a *runtime error* (not a `ZodError`). 

```ts
const schema = z.string().transform(val => val.length);

schema.encode(1234); 
// ❌ Error: Encountered unidirectional transform during encode: ZodTransform
```

{/* ### Success

`ZodSuccess` is also strictly unidirectional, and will throw an error if encountered during an encode operation.

```ts
const successSchema = z.success(z.string());

z.decode(successSchema, "hello"); 
// => true

z.encode(successSchema, true);    
// ❌ Error: Encountered unidirectional transform during encode: ZodSuccess
``` */}


## Useful codecs

Below are implementations for a bunch of commonly-needed codecs. For the sake of customizability, these are not included as first-class APIs in Zod itself. Instead, you should copy/paste them into your project and modify them as needed.

> **Note** — The codec implementations below are tested for correctness. 

### `stringToNumber`

Converts string representations of numbers to JavaScript `number` type using `parseFloat()`.

```ts
const stringToNumber = z.codec(z.string().regex(z.regexes.number), z.number(), {
  decode: (str) => Number.parseFloat(str),
  encode: (num) => num.toString(),
});

stringToNumber.decode("42.5");  // => 42.5
stringToNumber.encode(42.5);    // => "42.5"
```

### `stringToInt`

Converts string representations of integers to JavaScript `number` type using `parseInt()`.

```ts
const stringToInt = z.codec(z.string().regex(z.regexes.integer), z.int(), {
  decode: (str) => Number.parseInt(str, 10),
  encode: (num) => num.toString(),
});

stringToInt.decode("42");  // => 42
stringToInt.encode(42);    // => "42"
```

### `stringToBigInt`

Converts string representations to JavaScript `bigint` type.

```ts
const stringToBigInt = z.codec(z.string(), z.bigint(), {
  decode: (str) => BigInt(str),
  encode: (bigint) => bigint.toString(),
});

stringToBigInt.decode("12345");  // => 12345n
stringToBigInt.encode(12345n);   // => "12345"
```

### `numberToBigInt`

Converts JavaScript `number` to `bigint` type.

```ts
const numberToBigInt = z.codec(z.int(), z.bigint(), {
  decode: (num) => BigInt(num),
  encode: (bigint) => Number(bigint),
});

numberToBigInt.decode(42);   // => 42n
numberToBigInt.encode(42n);  // => 42
```

### `isoDatetimeToDate`

Converts ISO datetime strings to JavaScript `Date` objects.

```ts
const isoDatetimeToDate = z.codec(z.iso.datetime(), z.date(), {
  decode: (isoString) => new Date(isoString),
  encode: (date) => date.toISOString(),
});

isoDatetimeToDate.decode("2024-01-15T10:30:00.000Z");  // => Date object
isoDatetimeToDate.encode(new Date("2024-01-15"));       // => "2024-01-15T00:00:00.000Z"
```

### `epochSecondsToDate`

Converts Unix timestamps (seconds since epoch) to JavaScript `Date` objects.

```ts
const epochSecondsToDate = z.codec(z.int().min(0), z.date(), {
  decode: (seconds) => new Date(seconds * 1000),
  encode: (date) => Math.floor(date.getTime() / 1000),
});

epochSecondsToDate.decode(1705314600);  // => Date object
epochSecondsToDate.encode(new Date());  // => Unix timestamp in seconds
```

### `epochMillisToDate`

Converts Unix timestamps (milliseconds since epoch) to JavaScript `Date` objects.

```ts
const epochMillisToDate = z.codec(z.int().min(0), z.date(), {
  decode: (millis) => new Date(millis),
  encode: (date) => date.getTime(),
});

epochMillisToDate.decode(1705314600000);  // => Date object
epochMillisToDate.encode(new Date());     // => Unix timestamp in milliseconds
```

### `json(schema)`

Parses JSON strings into structured data and serializes back to JSON. This generic function accepts an output schema to validate the parsed JSON data.

```ts
const jsonCodec = <T extends z.core.$ZodType>(schema: T) =>
  z.codec(z.string(), schema, {
    decode: (jsonString, ctx) => {
      try {
        return JSON.parse(jsonString);
      } catch (err: any) {
        ctx.issues.push({
          code: "invalid_format",
          format: "json",
          input: jsonString,
          message: err.message,
        });
        return z.NEVER;
      }
    },
    encode: (value) => JSON.stringify(value),
  });
```

Usage example with a specific schema:

```ts
const jsonToObject = jsonCodec(z.object({ name: z.string(), age: z.number() }));

jsonToObject.decode('{"name":"Alice","age":30}');  
// => { name: "Alice", age: 30 }

jsonToObject.encode({ name: "Bob", age: 25 });     
// => '{"name":"Bob","age":25}'

jsonToObject.decode('~~invalid~~'); 
// ZodError: [
//   {
//     "code": "invalid_format",
//     "format": "json",
//     "path": [],
//     "message": "Unexpected token '~', \"~~invalid~~\" is not valid JSON"
//   }
// ]
```

### `utf8ToBytes`

Converts UTF-8 strings to `Uint8Array` byte arrays.

```ts
const utf8ToBytes = z.codec(z.string(), z.instanceof(Uint8Array), {
  decode: (str) => new TextEncoder().encode(str),
  encode: (bytes) => new TextDecoder().decode(bytes),
});

utf8ToBytes.decode("Hello, 世界!");  // => Uint8Array
utf8ToBytes.encode(bytes);          // => "Hello, 世界!"
```

### `bytesToUtf8`

Converts `Uint8Array` byte arrays to UTF-8 strings.

```ts
const bytesToUtf8 = z.codec(z.instanceof(Uint8Array), z.string(), {
  decode: (bytes) => new TextDecoder().decode(bytes),
  encode: (str) => new TextEncoder().encode(str),
});

bytesToUtf8.decode(bytes);          // => "Hello, 世界!"
bytesToUtf8.encode("Hello, 世界!");  // => Uint8Array
```

### `base64ToBytes`

Converts base64 strings to `Uint8Array` byte arrays and vice versa.

```ts
const base64ToBytes = z.codec(z.base64(), z.instanceof(Uint8Array), {
  decode: (base64String) => z.util.base64ToUint8Array(base64String),
  encode: (bytes) => z.util.uint8ArrayToBase64(bytes),
});

base64ToBytes.decode("SGVsbG8=");  // => Uint8Array([72, 101, 108, 108, 111])
base64ToBytes.encode(bytes);       // => "SGVsbG8="
```

### `base64urlToBytes`

Converts base64url strings (URL-safe base64) to `Uint8Array` byte arrays.

```ts
const base64urlToBytes = z.codec(z.base64url(), z.instanceof(Uint8Array), {
  decode: (base64urlString) => z.util.base64urlToUint8Array(base64urlString),
  encode: (bytes) => z.util.uint8ArrayToBase64url(bytes),
});

base64urlToBytes.decode("SGVsbG8");  // => Uint8Array([72, 101, 108, 108, 111])
base64urlToBytes.encode(bytes);      // => "SGVsbG8"
```

### `hexToBytes`

Converts hexadecimal strings to `Uint8Array` byte arrays and vice versa.

```ts
const hexToBytes = z.codec(z.hex(), z.instanceof(Uint8Array), {
  decode: (hexString) => z.util.hexToUint8Array(hexString),
  encode: (bytes) => z.util.uint8ArrayToHex(bytes),
});

hexToBytes.decode("48656c6c6f");     // => Uint8Array([72, 101, 108, 108, 111])
hexToBytes.encode(bytes);            // => "48656c6c6f"
```

### `stringToURL`

Converts URL strings to JavaScript `URL` objects.

```ts
const stringToURL = z.codec(z.url(), z.instanceof(URL), {
  decode: (urlString) => new URL(urlString),
  encode: (url) => url.href,
});

stringToURL.decode("https://example.com/path");  // => URL object
stringToURL.encode(new URL("https://example.com"));  // => "https://example.com/"
```

### `stringToHttpURL`

Converts HTTP/HTTPS URL strings to JavaScript `URL` objects.

```ts
const stringToHttpURL = z.codec(z.httpUrl(), z.instanceof(URL), {
  decode: (urlString) => new URL(urlString),
  encode: (url) => url.href,
});

stringToHttpURL.decode("https://api.example.com/v1");  // => URL object
stringToHttpURL.encode(url);                           // => "https://api.example.com/v1"
```

### `uriComponent`

Encodes and decodes URI components using `encodeURIComponent()` and `decodeURIComponent()`.

```ts
const uriComponent = z.codec(z.string(), z.string(), {
  decode: (encodedString) => decodeURIComponent(encodedString),
  encode: (decodedString) => encodeURIComponent(decodedString),
});

uriComponent.decode("Hello%20World%21");  // => "Hello World!"
uriComponent.encode("Hello World!");      // => "Hello%20World!"
```
