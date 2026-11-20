# function

Since version `1.7.0`, VChart provides the method `registerFunction` to register expression functions globally and on instances.
In principle, registration functions can be applied wherever user-defined callback functions are supported.
Supports function registration mechanism, aiming to solve the problem of inability to serialize scene functions such as mini programs and Feishu cards.

## registerFunction

`registerFunction` registers a function method. The registered function is available in the chart via the function name.

```ts
/**
 * Register function
 * @param key function name
 * @param fun function content
 * @returns
 */
registerFunction: (key: string, fun: Function) => void;
```

## unregisterFunction

`unregisterFunction` unregisters the function method. After logging out the function is not available in the chart.

```ts
/**
 * Logout function
 * @param key function name
 */
unregisterFunction: (key: string) => void;
```

## getFunction

`getFunction` This method will get the function based on the function name.

```ts
/**
 * Get function
 * @param key function name
 * @returns
 */
getFunction: (key: string) => Function | null;
```

## getFunctionList

`getFunctionList` This method can obtain a list of all function names.

```ts
/**
 * Get function list
 * @returns
 */
getFunctionList: () => string[] | null;
```