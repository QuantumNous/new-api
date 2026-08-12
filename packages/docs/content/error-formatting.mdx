---
title: Formatting errors
description: "Utilities for formatting and displaying Zod errors"
---

import { Callout } from "fumadocs-ui/components/callout";
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';

Zod emphasizes _completeness_ and _correctness_ in its error reporting. In many cases, it's helpful to convert the `$ZodError` to a more useful format. Zod provides some utilities for this.

Consider this simple object schema.

```ts
import * as z from "zod";

const schema = z.strictObject({
  username: z.string(),
  favoriteNumbers: z.array(z.number()),
});
```

Attempting to parse this invalid data results in an error containing three issues.

```ts
const result = schema.safeParse({
  username: 1234,
  favoriteNumbers: [1234, "4567"],
  extraKey: 1234,
});

result.error!.issues;
[
  {
    expected: 'string',
    code: 'invalid_type',
    path: [ 'username' ],
    message: 'Invalid input: expected string, received number'
  },
  {
    expected: 'number',
    code: 'invalid_type',
    path: [ 'favoriteNumbers', 1 ],
    message: 'Invalid input: expected number, received string'
  },
  {
    code: 'unrecognized_keys',
    keys: [ 'extraKey' ],
    path: [],
    message: 'Unrecognized key: "extraKey"'
  }
];
```


## `z.treeifyError()`

To convert ("treeify") this error into a nested object, use `z.treeifyError()`.


```ts
const tree = z.treeifyError(result.error);

// =>
{
  errors: [ 'Unrecognized key: "extraKey"' ],
  properties: {
    username: { errors: [ 'Invalid input: expected string, received number' ] },
    favoriteNumbers: {
      errors: [],
      items: [
        undefined,
        {
          errors: [ 'Invalid input: expected number, received string' ]
        }
      ]
    }
  }
}
```

The result is a nested structure that mirrors the schema itself. You can easily access the errors that occurred at a particular path. The `errors` field contains the error messages at a given path, and the special properties `properties` and `items` let you traverse deeper into the tree.

```ts
tree.properties?.username?.errors;
// => ["Invalid input: expected string, received number"]

tree.properties?.favoriteNumbers?.items?.[1]?.errors;
// => ["Invalid input: expected number, received string"];
```

> Be sure to use optional chaining (`?.`) to avoid errors when accessing nested properties.

## `z.prettifyError()`

The `z.prettifyError()` provides a human-readable string representation of the error.

```ts
const pretty = z.prettifyError(result.error);
```

This returns the following string:

```
✖ Unrecognized key: "extraKey"
✖ Invalid input: expected string, received number
  → at username
✖ Invalid input: expected number, received string
  → at favoriteNumbers[1]
```


## `z.formatError()`

<Callout type="warn">
  Deprecated. Use `z.treeifyError()` instead.
</Callout>

<Accordions>
  <Accordion title="Show docs">

    To convert the error into a nested object:

     ```ts
    const formatted = z.formatError(result.error);

    // returns:
    {
      _errors: [ 'Unrecognized key: "extraKey"' ],
      username: { _errors: [ 'Invalid input: expected string, received number' ] },
      favoriteNumbers: {
        '1': { _errors: [ 'Invalid input: expected number, received string' ] },
        _errors: []
      }
    }
    ```

    The result is a nested structure that mirrors the schema itself. You can easily access the errors that occurred at a particular path.

    ```ts
    formatted?.username?._errors;
    // => ["Invalid input: expected string, received number"]

    formatted?.favoriteNumbers?.[1]?._errors;
    // => ["Invalid input: expected number, received string"]
    ```

    > Be sure to use optional chaining (`?.`) to avoid errors when accessing nested properties.

  </Accordion>
  </Accordions>

## `z.flattenError()`

While `z.treeifyError()` is useful for traversing a potentially complex nested structure, the majority of schemas are *flat*—just one level deep. In this case, use `z.flattenError()` to retrieve a clean, shallow error object.

```ts
const flattened = z.flattenError(result.error);
// { errors: string[], properties: { [key: string]: string[] } }

{
  formErrors: [ 'Unrecognized key: "extraKey"' ],
  fieldErrors: {
    username: [ 'Invalid input: expected string, received number' ],
    favoriteNumbers: [ 'Invalid input: expected number, received string' ]
  }
}
```

The `formErrors` array contains any top-level errors (where `path` is `[]`). The `fieldErrors` object provides an array of errors for each field in the schema.

```ts
flattened.fieldErrors.username; // => [ 'Invalid input: expected string, received number' ]
flattened.fieldErrors.favoriteNumbers; // => [ 'Invalid input: expected number, received string' ]
```
