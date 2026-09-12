{{ target: series-bar-style }}

#${prefix} barWidth(number|string)

The width of the column can be set as an absolute pixel value or as a percentage (such as '10%'). If not configured, it will be adaptive by default.

- `number` type, representing pixel value
- `string` type, percentage usage, such as '10%', this value is the proportion of bandWidth relative to scale

#${prefix} barMinWidth(number|string)

The minimum width of the column, you can set an absolute pixel value, or you can use a percentage (such as '10%').

- `number` type, representing pixel value
- `string` type, percentage usage, such as '10%', this value is the proportion of bandWidth relative to scale

#${prefix} barMaxWidth(number|string)

The maximum width of the column, you can set an absolute pixel value, or you can use a percentage (such as '10%').

- `number` type, representing pixel value
- `string` type, percentage usage, such as '10%', this value is the proportion of bandWidth relative to scale

#${prefix} barGapInGroup(number|string)

Supported since `1.2.0` version, it is used to adjust the column spacing within each group in the grouped column chart. You can set the absolute pixel value or use a percentage (such as '10%'). When there are multiple layers of grouping, you can use an array to set the spacing of different levels, such as [10, '20%'], which means that the spacing of the first layer of grouping is 10px, and the spacing of the second layer of grouping is '20%'.

If the number of arrays in `barGapInGroup` is less than the number of grouping levels, the last value will be used for subsequent grouping spacing.

- `number` type, representing pixel value
- `string` type, percentage usage, such as '10%', this value is the bandWidth proportion of the scale corresponding to the last grouping field (because the columns are of equal width, the scale of the last layer of grouping is used)

#${prefix} barMinHeight(number)

Supported since `1.4.0` version, used to configure the minimum height of the bar, which can be used to prevent visual adjustments of a data item whose value is too small.

#${prefix} stackCornerRadius(number|number[]|Function)

Supported since `1.4.0` version, used to configure the overall rounded corners of stacked bar groups.

Supported since `1.12.4` version, you can use callback to set stackCornerRadius, The function type is defined as follows:

```ts
/**
 * @param attr bar group attribute
 * @param datum bar group datum
 * @param ctx context of series
 * @returns
 */
export type IStackCornerRadiusCallback = (
  attr: IRectGraphicAttribute,
  datum: Datum,
  ctx: ISeriesMarkAttributeContext
) => number | number[];
```
