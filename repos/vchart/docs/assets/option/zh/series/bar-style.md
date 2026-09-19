{{ target: series-bar-style }}

#${prefix} barWidth(number|string)

柱子的宽度，可以设置绝对的像素值，也可以使用百分比（如 '10%'）。如果不配置，默认自适应。

- `number` 类型，表示像素值
- `string` 类型，百分比用法，如 '10%'，该值为相对 scale 的 bandWidth 占比

#${prefix} barMinWidth(number|string)

柱子的最小宽度，可以设置绝对的像素值，也可以使用百分比（如 '10%'）。

- `number` 类型，表示像素值
- `string` 类型，百分比用法，如 '10%'，该值为相对 scale 的 bandWidth 占比

#${prefix} barMaxWidth(number|string)

柱子的最大宽度，可以设置绝对的像素值，也可以使用百分比（如 '10%'）。

- `number` 类型，表示像素值
- `string` 类型，百分比用法，如 '10%'，该值为相对 scale 的 bandWidth 占比

#${prefix} barGapInGroup(number|string)

自 `1.2.0` 版本开始支持，用于调整分组柱图中各个分组内的柱子间距，可以设置绝对的像素值，也可以使用百分比（如 '10%'）。当存在多层分组时，可以使用数组来设置不同层级的间距，如 [10, '20%']，表示第一层分组的间距为 10px，第二层分组的间距为 '20%'。

如果 `barGapInGroup` 的数组个数小于分组层数，则后面的分组间距使用最后一个值。

- `number` 类型，表示像素值
- `string` 类型，百分比用法，如 '10%'，该值为对应最后一个分组字段对应的 scale 的 bandWidth 占比(因为柱子是等宽的，所以采用最后一层分组的 scale)

#${prefix} barMinHeight(number)

自 `1.4.0` 版本开始支持，用于配置柱条最小高度，可用于防止某数据项的值过小的视觉调整。

#${prefix} stackCornerRadius(number|number[])

自 `1.10.0` 版本开始支持，用于配置堆叠柱整体的圆角。

从`1.12.4`版本开始支持，可以使用回调来设置 stackCornerRadius，函数类型定义如下：

```ts
/**
 * @param attr 分组属性
 * @param datum 分组数据
 * @param ctx 上下文
 * @returns
 */
export type IStackCornerRadiusCallback = (
  attr: IRectGraphicAttribute,
  datum: Datum,
  ctx: ISeriesMarkAttributeContext
) => number | number[];
```
