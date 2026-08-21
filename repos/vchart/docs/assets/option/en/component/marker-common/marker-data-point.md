{{ target: component-marker-data-point }}

{{ if: ${isSingle} }}

Since version 1.12.0, `coordinate` can directly configure the callback function. The data structure returned by the callback function is `IDataPointSpec`, which is consistent with the structure of the unconfigured callback, as follows:

```ts
/**
 * @param `seriesData` is the data of the associated series
 * @param `series` is the associated series instance
 */
coordinate: (seriesData, series) => {
  return { x: 10, y: 30 };
};
```

{{ else }}

Since version 1.12.0, `coordinates` can directly configure the callback function, and the data structure returned by the callback function is `IDataPointSpec[]`, which is consistent with the structure of the unconfigured callback, as follows:

```ts
/**
 * @param `seriesData` is the data of the associated series
 * @param `series` is the associated series instance
 */
coordinates: (seriesData, series) => {
  return [{ x: 10, y: 30 }];
};
```

{{/if}}

#${prefix} [key(string | number)](string | number)

Data field and data value configuration supports:

1. Directly configure the data value, such as `{ x: 'A', y: 123 }`, where `'x'`, `'y'` are the corresponding data fields in the original data set
2. For numerical type fields, you can also configure the aggregation method, such as: `{ x: 'A', y: 'sum' }`. The aggregation method supports the following:
   Optional values:

   - 'sum'
   - 'average'
     -'min'
   - 'max'
   - 'variance'
   - 'standardDeviation'
   - 'median'

3. Callback function(**Since `1.7.3` version**). When you expect your label position to be dynamic, you can configure a callback for the corresponding data field, and then process it according to your needs in the callback function. The callback parameters are as follows:

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

`example`:

```ts
coordinates: [
  {
    x: (relativeSeriesData, startRelativeSeriesData, endRelativeSeriesData, relativeSeries) => {
      const scale = relativeSeries.getXAxisHelper().getScale(0);
      console.log(scale.domain());

      return scale.domain()[1];
    },
    y: (relativeSeriesData, startRelativeSeriesData, endRelativeSeriesData, relativeSeries) => {
      const scale = relativeSeries.getYAxisHelper().getScale();
      console.log(scale.domain());

      return scale.domain()[1];
    }
  }
];
```

#${prefix} refRelativeSeriesIndex(number)

The specific series index related to a data element (only valid under the target: data element).

#${prefix} refRelativeSeriesId(string)

The specific series ID related to a data element (only valid under the target: data element).

#${prefix} xFieldIndex(number) = 0

Supported since `1.7.0` version, used to specify which dimension index on xField to use, because xField field may contain multiple dimensions, such as grouping scenarios. The default value is 0.

#${prefix}xFieldDim(string)

Supported since `1.7.0` version, specify the dimension name on xField, because xField field may contain multiple dimensions, such as grouping scenarios.

`xFieldIndex` and `xFieldDim` can be declared only once. If they are declared at the same time, `xFieldDim` will have a higher priority.

#${prefix} yFieldIndex(number) = 0

Supported since version `1.7.0`, specify the dimension index on yField to use, because the yField field may contain multiple dimensions, such as grouping scenarios. The default value is 0.

#${prefix} yFieldDim(string)

Supported since `1.7.0` version, specify the dimension name on yField, because the yField field may contain multiple dimensions, such as grouping scenarios.

`yFieldIndex` and `yFieldDim` can be declared only once. If they are declared at the same time, `yFieldDim` will have a higher priority.

#${prefix} angleFieldIndex(number) = 0

Supported since version `1.11.0`, specify the dimension index on angleField to use, because the angleField field may contain multiple dimensions, such as grouping scenarios. The default value is 0.

#${prefix} angleFieldDim(string)

Supported since `1.11.0` version, specify the dimension name on angleField, because the angleField field may contain multiple dimensions, such as grouping scenarios.

`angleFieldIndex` and `angleFieldDim` can be declared only once. If they are declared at the same time, `angleFieldDim` will have a higher priority.

#${prefix} radiusFieldIndex(number) = 0

Supported since `1.11.0` version, specify the dimension index on radiusField to use, because the radiusField field may contain multiple dimensions, such as grouping scenarios. The default value is 0.

#${prefix} radiusFieldDim(string)

Supported since `1.11.0` version, specify the dimension name on radiusField, because the radiusField field may contain multiple dimensions, such as grouping scenarios.

`radiusFieldIndex` and `radiusFieldDim` can be declared only one time. If they are declared at the same time, `radiusFieldDim` will have a higher priority.
