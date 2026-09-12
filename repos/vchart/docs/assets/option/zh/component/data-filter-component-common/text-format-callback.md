
{{ target: text-format-callback }}

<!-- TextFormat -->

${description}支持回调，回调函数的定义如下:

```ts
/**
 * @params text 当前元素对应的文本
 * @return 返回处理后的文本
 */
(text: string | number) => string | number;
```