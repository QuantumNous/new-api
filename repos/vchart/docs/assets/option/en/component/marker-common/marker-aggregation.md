{{ target: component-marker-aggregation-type }}

<!-- MarkerAggregaitonType -->

1. Numeric aggregation type.

   Optional values:

   - `'sum'`: sum
   - `'average'`: mean
   - `'min'`: minimum value
   - `'max'`: maximum value
   - `'variance'`: variance
   - `'standardDeviation'`: standard deviation
   - `'median'`: median

2. Callback function

The type definition is as follows:

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
