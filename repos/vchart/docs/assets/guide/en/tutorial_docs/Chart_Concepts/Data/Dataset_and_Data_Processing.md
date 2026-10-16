# DataSet

VChart uses a data processing tool `@visactor/vdataset`. This tutorial will introduce the related features of DataSet in detail.

## Basic Concepts

There are two important objects in the DataSet.

- `DataView` data view, which can be understood as a set of data.
- `DataSet` dataset, a tool for managing multiple `DataView`, with data dependency, `DataView` under the same `DataSet` can complete automatic update.

In addition, there are several concepts related to data processing

- `parser` data parsing, which parses raw data into more commonly used structures, such as parsing `csv` data into regular data objects.
- `transform` data transformation, which operates on data, can change the original data, can use statistical methods on the original data to generate a new set of data, etc.

> In VChart, a chart will use a `DataSet`, and multiple charts can share a `DataSet`. Sharing `DataSet` can implement data-based linkage between multiple charts.

## Feature Introduction

### DataSet & DataView

The `DataSet` instance has interfaces for obtaining `DataView`, registering `parser`, and `transform`. At the same time, the creation of `DataView` requires specifying a `DataSet` object.

```js
import { DataSet, csvParser, dataViewParser, statistics } from '@visactor/vdataset';

const dataSet = new DataSet();
// parser, transform registration
dataSet.registerParser('csv', csvParser);
dataSet.registerParser('dataview', dataViewParser);
dataSet.registerTransform('statistics', statistics);
const dataView = new DataView(dataSet, { name: 'data' });
```

### parser

`parser` is a tool for parsing raw data. It is a function with the following type:

```js
// data is the raw content received by DataView, option is the input parameter when the parser is executed, the dataView is the current data view being parsed
export type Parser = (data: any, options: Object, dataView: DataView) => any;
```

Usage example:

```js
export interface ICsvParserOptions {
  delimiter?: string;
}
const csvParser = (data: string, option: ICsvParserOptions, dataView: DataView) => {
  /** ...*/
};
// Register parser first
dataSet.registerParser('csv', csvParser);
// use
dataView.parse(
  `year,group,value
1990,18-34,16.9
1990,35-49,12.2
1990,50-64,10.2
1990,65+,5.2
1991,18-34,17
1991,35-49,17.8
1991,50-64,10
1991,65+,4.8
1993,18-34,26.5
1993,35-49,23.8
1993,50-64,16.8
1993,65+,6.6
`,
  {
    type: 'csv',
    option: {
      delimiter: ','
    }
  }
);
```

### transform

`parser` is a data transformation tool. A `DataView` can have multiple `transform`, which are executed sequentially, and the data obtained by the next `transform` is the result of the transformation of the previous `transform`.

Type:

```js
export type Transform = (data: any, options?: Object) => any;
type TransformName = string;
export interface ITransformOptions {
  type: TransformName;
  options?: Object;
  level?: number; // If level is configured, the transform on DataView will be sorted according to level
}
```

Usage example:

```js
export interface IStatisticsOptions {
  fields: string[];
  operations: Array<
    | 'count'
    | 'max'
    | 'min'
    | 'mean'
    | 'average'
    | 'median'
    | 'mode'
    | 'product'
    | 'standardDeviation'
    | 'sum'
    | 'sumSimple'
    | 'variance'
  >;
  as?: string[];
  groupBy?: string;
}
const statisticsTransform = (data: string, option: IStatisticsOptions) => {
  /** ...*/
};
// Register the transform first
dataSet.registerTransform('statistics', statisticsTransform);
// use
dataView.transform({
  type: 'statistics',
  option: {
    fields: ['year'],
    operations: ['average'],
    as: ['avg'],
    groupBy: 'group'
  }
});
```

### Usage Examples

Now let's use an example to explain how to use DataSet to handle data and use it in a chart.

In the example below, the data is the percentage of the adult population that "accept the same-sex relationships" in an area for 3 years. One data set is for data under the age of 50, the other is for data over the age of 50. We will perform the following operations

1. Parse the 2 CSV data sets separately, obtaining 2 data views dataView1 and dataView2
2. Use a new data view dataViewMerge, depending on dataView1 and dataView2, to merge their data.
3. Then create a new data view dataViewAvg and perform statistics on the data obtained in step 2 to get an average value data.
4. Use dataViewMerge and dataViewAvg to draw a combination chart, using a bar chart to display the original proportion data, and a line to represent the average value.

```js
// Referenced content
import { DataSet, csvParser, dataViewParser, statistics } from '@visactor/vdataset';
// Create dataset instance
const dataSet = new DataSet();
// Register parser, transform
dataSet.registerParser('csv', csvParser);
dataSet.registerParser('dataview-', dataViewParser);
dataSet.registerTransform('statistics', statistics);

// 2 sets of raw data
const dataLess50 = `year,group,value
1990,18-34,16.9
1990,35-49,12.2
1991,18-34,17
1991,35-49,17.8
1993,18-34,26.5
1993,35-49,23.8
`;
const dataOver50 = `year,group,value
1990,50-64,10.2
1990,65+,5.2
1991,50-64,10
1991,65+,4.8
1993,50-64,16.8
1993,65+,6.6
`;

// Parse 2 sets of raw data
const dataView1 = new DataView(dataSet, { name: 'dataView1' });
dataView1.parse(dataLess50, { type: 'csv' });
const dataView2 = new DataView(dataSet, { name: 'dataView2' });
dataView2.parse(dataOver50, { type: 'csv' });

// Create dataViewMerge
const dataViewMerge = new DataView(dataSet, { name: 'dataViewMerge' });
// Make it refer to dataView1, dataView2
dataViewMerge.parse([dataView1, dataView2], { type: 'dataview' });
// Now let's implement a merge transform ourselves
const mergeDataViewTransform = (data: DataView[], opt) => {
  // At this point, the data we receive is an array data = [dataView1,dataView2]
  const result = [];
  data.forEach(d => {
    // The latestData property of the dataView is its final data
    result.push(...d.latestData);
  });
  return result;
};
// Register merge transform
dataSet.registerTransform('mergeDataView', mergeDataViewTransform);
// Use merge transform to merge data
dataViewMerge.transform({ type: 'mergeDataView' });

/**
 * At this point, dataViewMerge data processing is complete.
 * The final data content is as follows
  [
    { year: '1990', group: '18-34', value: 16.9 },
    { year: '1990', group: '35-49', value: 12.2 },
    { year: '1991', group: '18-34', value: 17 },
    { year: '1991', group: '35-49', value: 17.8 },
    { year: '1993', group: '18-34', value: 26.5 },
    { year: '1993', group: '35-49', value: 23.8 },
    { year: '1990', group: '50-64', value: 10.2 },
    { year: '1990', group: '65+', value: 5.2 },
    { year: '1991', group: '50-64', value: 10 },
    { year: '1991', group: '65+', value: 4.8 },
    { year: '1993', group: '50-64', value: 16.8 },
    { year: '1993', group: '65+', value: 6.6 }
  ]
*/

// Create average value data, make it refer to dataViewMerge
const dataViewAvg = new DataView(dataSet, { name: 'dataViewAvg' });
dataViewAvg.parse([dataViewMerge], { type: 'dataview' });
// At this point, the data content in dataViewAvg is the same as that in dataViewMerge
// The built-in statistics transform can generate statistical data
dataViewAvg.transform({
  type: 'statistics'
  options: {
    fields: ['value'],
    operations: ['average'],
    as: ['avg'],
    groupBy: 'year'
  }
});
/**
 * So far, dataViewAvg data processing has been completed
 * The final data content is as follows
  [
    { year: '1990', group: '18-34', value: 11.125 },
    { year: '1991', group: '18-34', value: 12.4 },
    { year: '1993', group: '18-34', value: 18.425 },
  ]
*/


const spec = {
  type: 'common',
  stackField: 'stack',
  seriesField: 'type',
  data: [
    dataViewMerge,
    dataViewAvg
  ],
  series: [
    {
      type: 'bar',
      dataId: 'dataViewMerge', // use id to correspond to data
      xField: 'year',
      yField: 'value',
      seriesField: 'group'
    },
    {
      type: 'line',
      dataId: 'dataViewAvg', // use id to correspond to data
      xField: 'year',
      yField: 'avg',
    },
  ],
  axes: [{ orient: 'left' }, { orient: 'bottom', type: 'band' }]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

```

### Dependency Update

Regarding dependency update, in the example above, if data needs to be updated, for example, the data increases from `[1990, 1991, 1993]` to `[1990, 1991, 1993, 1995, 1997]`, you only need to update the corresponding `dataView1` and `dataView2`. `dataViewMerge` and `dataViewAvg` used by the chart will be automatically updated. The chart content will also change accordingly.

This is because when the dependency relationship of dataView is established, an update link will be created by default. When the upper data is updated, the lower data will be automatically notified to update.

We can use the same DataSet in multiple charts and use dependency updates to easily achieve data-based linkage effects.
