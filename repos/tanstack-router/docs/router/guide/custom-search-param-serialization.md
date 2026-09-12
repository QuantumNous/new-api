---
title: Custom Search Param Serialization
---

By default, TanStack Router parses and serializes your URL Search Params automatically using `JSON.stringify` and `JSON.parse`. This process involves escaping and unescaping the search string, which is a common practice for URL search params, in addition to the serialization and deserialization of the search object.

For instance, using the default configuration, if you have the following search object:

```tsx
const search = {
  page: 1,
  sort: 'asc',
  filters: { author: 'tanner', min_words: 800 },
}
```

It would be serialized and escaped into the following search string:

```txt
?page=1&sort=asc&filters=%7B%22author%22%3A%22tanner%22%2C%22min_words%22%3A800%7D
```

We can implement the default behavior with the following code:

<!-- ::start:framework -->

# React

```tsx
import {
  createRouter,
  parseSearchWith,
  stringifySearchWith,
} from '@tanstack/react-router'

const router = createRouter({
  // ...
  parseSearch: parseSearchWith(JSON.parse),
  stringifySearch: stringifySearchWith(JSON.stringify),
})
```

# Solid

```tsx
import {
  createRouter,
  parseSearchWith,
  stringifySearchWith,
} from '@tanstack/solid-router'

const router = createRouter({
  // ...
  parseSearch: parseSearchWith(JSON.parse),
  stringifySearch: stringifySearchWith(JSON.stringify),
})
```

<!-- ::end:framework -->

However, this default behavior may not be suitable for all use cases. For example, you may want to use a different serialization format, such as base64 encoding, or you may want to use a purpose-built serialization/deserialization library, like [query-string](https://github.com/sindresorhus/query-string), [JSURL2](https://github.com/wmertens/jsurl2), or [Zipson](https://jgranstrom.github.io/zipson/).

This can be achieved by providing your own serialization and deserialization functions to the `parseSearch` and `stringifySearch` options in the [`Router`](../api/router/RouterOptionsType.md#stringifysearch-method) configuration. When doing this, you can utilize TanStack Router's built-in helper functions, `parseSearchWith` and `stringifySearchWith`, to simplify the process.

> [!TIP]
> An important aspect of serialization and deserialization, is that you are able to get the same object back after deserialization. This is important because if the serialization and deserialization process is not done correctly, you may lose some information. For example, if you are using a library that does not support nested objects, you may lose the nested object when deserializing the search string.

![Diagram showing idempotent nature of URL search param serialization and deserialization](https://raw.githubusercontent.com/TanStack/router/main/docs/router/assets/search-serialization-deserialization-idempotency.jpg)

Here are some examples of how you can customize the search param serialization in TanStack Router:

## Using Base64

It's common to base64 encode your search params to achieve maximum compatibility across browsers and URL unfurlers, etc. This can be done with the following code:

<!-- ::start:framework -->

# React

```tsx
import {
  Router,
  parseSearchWith,
  stringifySearchWith,
} from '@tanstack/react-router'

const router = createRouter({
  parseSearch: parseSearchWith((value) => JSON.parse(decodeFromBinary(value))),
  stringifySearch: stringifySearchWith((value) =>
    encodeToBinary(JSON.stringify(value)),
  ),
})

function decodeFromBinary(str: string): string {
  return decodeURIComponent(
    Array.prototype.map
      .call(atob(str), function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      })
      .join(''),
  )
}

function encodeToBinary(str: string): string {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
      return String.fromCharCode(parseInt(p1, 16))
    }),
  )
}
```

# Solid

```tsx
import {
  Router,
  parseSearchWith,
  stringifySearchWith,
} from '@tanstack/solid-router'

const router = createRouter({
  parseSearch: parseSearchWith((value) => JSON.parse(decodeFromBinary(value))),
  stringifySearch: stringifySearchWith((value) =>
    encodeToBinary(JSON.stringify(value)),
  ),
})

function decodeFromBinary(str: string): string {
  return decodeURIComponent(
    Array.prototype.map
      .call(atob(str), function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      })
      .join(''),
  )
}

function encodeToBinary(str: string): string {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
      return String.fromCharCode(parseInt(p1, 16))
    }),
  )
}
```

<!-- ::end:framework -->

> [⚠️ Why does this snippet not use atob/btoa?](#safe-binary-encodingdecoding)

So, if we were to turn the previous object into a search string using this configuration, it would look like this:

```txt
?page=1&sort=asc&filters=eyJhdXRob3IiOiJ0YW5uZXIiLCJtaW5fd29yZHMiOjgwMH0%3D
```

> [!WARNING]
> If you are serializing user input into Base64, you run the risk of causing a collision with the URL deserialization. This can lead to unexpected behavior, such as the URL not being parsed correctly or being interpreted as a different value. To avoid this, you should encode the search params using a safe binary encoding/decoding method (see below).

## Using the query-string library

The [query-string](https://github.com/sindresorhus/query-string) library is a popular for being able to reliably parse and stringify query strings. You can use it to customize the serialization format of your search params. This can be done with the following code:

<!-- ::start:framework -->

# React

```tsx
import { createRouter } from '@tanstack/react-router'
import qs from 'query-string'

const router = createRouter({
  // ...
  stringifySearch: stringifySearchWith((value) =>
    qs.stringify(value, {
      // ...options
    }),
  ),
  parseSearch: parseSearchWith((value) =>
    qs.parse(value, {
      // ...options
    }),
  ),
})
```

# Solid

```tsx
import { createRouter } from '@tanstack/solid-router'
import qs from 'query-string'

const router = createRouter({
  // ...
  stringifySearch: stringifySearchWith((value) =>
    qs.stringify(value, {
      // ...options
    }),
  ),
  parseSearch: parseSearchWith((value) =>
    qs.parse(value, {
      // ...options
    }),
  ),
})
```

<!-- ::end:framework -->

So, if we were to turn the previous object into a search string using this configuration, it would look like this:

```txt
?page=1&sort=asc&filters=author%3Dtanner%26min_words%3D800
```

## Using the JSURL2 library

[JSURL2](https://github.com/wmertens/jsurl2) is a non-standard library that can compress URLs while still maintaining readability. This can be done with the following code:

<!-- ::start:framework -->

# React

```tsx
import {
  Router,
  parseSearchWith,
  stringifySearchWith,
} from '@tanstack/react-router'
import { parse, stringify } from 'jsurl2'

const router = createRouter({
  // ...
  parseSearch: parseSearchWith(parse),
  stringifySearch: stringifySearchWith(stringify),
})
```

# Solid

```tsx
import {
  Router,
  parseSearchWith,
  stringifySearchWith,
} from '@tanstack/solid-router'
import { parse, stringify } from 'jsurl2'

const router = createRouter({
  // ...
  parseSearch: parseSearchWith(parse),
  stringifySearch: stringifySearchWith(stringify),
})
```

<!-- ::end:framework -->

So, if we were to turn the previous object into a search string using this configuration, it would look like this:

```txt
?page=1&sort=asc&filters=(author~tanner~min*_words~800)~
```

## Using the Zipson library

[Zipson](https://jgranstrom.github.io/zipson/) is a very user-friendly and performant JSON compression library (both in runtime performance and the resulting compression performance). To compress your search params with it (which requires escaping/unescaping and base64 encoding/decoding them as well), you can use the following code:

<!-- ::start:framework -->

# React

```tsx
import {
  Router,
  parseSearchWith,
  stringifySearchWith,
} from '@tanstack/react-router'
import { stringify, parse } from 'zipson'

const router = createRouter({
  parseSearch: parseSearchWith((value) => parse(decodeFromBinary(value))),
  stringifySearch: stringifySearchWith((value) =>
    encodeToBinary(stringify(value)),
  ),
})

function decodeFromBinary(str: string): string {
  return decodeURIComponent(
    Array.prototype.map
      .call(atob(str), function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      })
      .join(''),
  )
}

function encodeToBinary(str: string): string {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
      return String.fromCharCode(parseInt(p1, 16))
    }),
  )
}
```

# Solid

```tsx
import {
  Router,
  parseSearchWith,
  stringifySearchWith,
} from '@tanstack/solid-router'
import { stringify, parse } from 'zipson'

const router = createRouter({
  parseSearch: parseSearchWith((value) => parse(decodeFromBinary(value))),
  stringifySearch: stringifySearchWith((value) =>
    encodeToBinary(stringify(value)),
  ),
})

function decodeFromBinary(str: string): string {
  return decodeURIComponent(
    Array.prototype.map
      .call(atob(str), function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      })
      .join(''),
  )
}

function encodeToBinary(str: string): string {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
      return String.fromCharCode(parseInt(p1, 16))
    }),
  )
}
```

<!-- ::end:framework -->

> [⚠️ Why does this snippet not use atob/btoa?](#safe-binary-encodingdecoding)

So, if we were to turn the previous object into a search string using this configuration, it would look like this:

```txt
?page=1&sort=asc&filters=JTdCJUMyJUE4YXV0aG9yJUMyJUE4JUMyJUE4dGFubmVyJUMyJUE4JUMyJUE4bWluX3dvcmRzJUMyJUE4JUMyJUEyQ3UlN0Q%3D
```

<hr>

## Safe Binary Encoding/Decoding

In the browser, the `atob` and `btoa` functions are not guaranteed to work properly with non-UTF8 characters. We recommend using these encoding/decoding utilities instead:

To encode from a string to a binary string:

```ts
export function encodeToBinary(str: string): string {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
      return String.fromCharCode(parseInt(p1, 16))
    }),
  )
}
```

To decode from a binary string to a string:

```ts
export function decodeFromBinary(str: string): string {
  return decodeURIComponent(
    Array.prototype.map
      .call(atob(str), function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      })
      .join(''),
  )
}
```
