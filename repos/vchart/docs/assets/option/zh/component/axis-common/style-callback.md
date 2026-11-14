{{ target: component-common-style-callback }}

<!-- StyleCallback -->

${description}支持回调，回调函数的定义如下:

{{ if: ${componentType} === 'discrete-legend' }}

```ts
/**
 * @params item 图例项的数据
 * @params isSelected 是否选中
 * @params index 索引
 * @params allItems 全量图例项数据
 * @return 返回对应的样式
 */
(item: LegendItemDatum, isSelected: boolean, index: number, allItems: LegendItemDatum[]) => T;
```

{{ else }}

```ts
/**
 * @params value 当前元素对应的数值
 * @params index 索引值
 * @params datum 当前元素携带的数据
 * @params data 全量数据
 * @return 返回对应的样式
 */
(value: any, index: number, datum: Datum, data: Datum[]) => Object;
```

{{ /if }}
