# 函数

自从`1.7.0`版本, VChart 提供全局和实例上注册表达式函数的方法 `registerFunction` 。
原则上，凡是支持用户自定义回调函数的地方，都可以应用注册函数。
支持函数注册机制，旨在解决小程序端、飞书卡片等场景函数无法序列化问题。

## registerFunction

`registerFunction` 注册函数方法。图表中可通过函数名称使用该注册函数。

```ts
/**
 * 注册函数
 * @param key 函数名称
 * @param fun 函数内容
 * @returns
 */
registerFunction: (key: string, fun: Function) => void;
```

## unregisterFunction

`unregisterFunction` 注销函数方法。注销后函数在图表中无法使用。

```ts
/**
 * 注销函数
 * @param key 函数名称
 */
unregisterFunction: (key: string) => void;
```

## getFunction

`getFunction` 该方法会根据函数名称获取函数。

```ts
/**
 * 获取函数
 * @param key 函数名称
 * @returns
 */
getFunction: (key: string) => Function | null;
```

## getFunctionList

`getFunctionList` 该方法可获取全部函数名列表。

```ts
/**
 * 获取函数列表
 * @returns
 */
getFunctionList: () => string[] | null;
```
