{{ target: text-format-callback }}

<!-- TextFormat -->

${description} supports callbacks, and the definition of the callback function is as follows:

```ts
/**
 * @params text 当前元素对应的文本
 * @return 返回处理后的文本
 */
(text: string | number) => string | number;
```