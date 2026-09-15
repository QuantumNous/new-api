{{ target: component-marker-aggregation-type }}

<!-- MarkerAggregaitonType -->

1. 数值聚合类型。

   可选值：

   - `'sum'`: 总和
   - `'average'`: 均值
   - `'min'`: 最小值
   - `'max'`: 最大值
   - `'variance'`: 方差
   - `'standardDeviation'`: 标准差
   - `'median'`: 中位数

2. 回调函数

类型定义如下：

```ts
export type IDataPosCallback = (
  relativeSeriesData: Datum[],
  startRelativeSeriesData: Datum[],
  endRelativeSeriesData: Datum[],
  relativeSeries: ICartesianSeries,
  startRelativeSeries: ICartesianSeries,
  endRelativeSeries: ICartesianSeries
) => StringOrNumber;
```
