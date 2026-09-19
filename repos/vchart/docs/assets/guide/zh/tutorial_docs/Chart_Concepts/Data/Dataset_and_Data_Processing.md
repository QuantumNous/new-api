# DataSet

VChart 中使用了一个数据处理工具 `@visactor/vdataset` 。本篇教程将详细介绍 DataSet 的相关功能。

## 基本概念

在 DataSet 中有 2 个重要的对象。

- `DataView` 数据视图，可以理解为一份数据。
- `DataSet` 数据集，管理多个 `DataView` 的工具，同一个 `DataSet` 下的 `DataView` 可以通过数据依赖，完成自动更新。

除此之外，还有几个与数据处理相关的概念

- `parser` 数据解析，将原始数据解析为更常用的结构，比如将 `csv` 数据解析为常规的数据对象。
- `transform` 数据变换，对数据进行操作，可以改变原始数据，可以对原始数据使用统计方法中生成一份新数据等等。

> 在 VChart 中，一个图表会使用一个 `DataSet` ，多个图表可以共用一个 `DataSet` 。共用 `DataSet` 可以实现多个图表间的基于数据的联动。

## 功能介绍

### DataSet & DataView

`DataSet` 实例上有获取 `DataView`，注册 `parser`、`transform` 的接口。同时 `DataView` 的创建需要指定一个 `DataSet` 对象。

```js
import { DataSet, csvParser, dataViewParser, statistics } from '@visactor/vdataset';

const dataSet = new DataSet();
// parser，transform 的注册
dataSet.registerParser('csv', csvParser);
dataSet.registerParser('dataview', dataViewParser);
dataSet.registerTransform('statistics', statistics);
const dataView = new DataView(dataSet, { name: 'data' });
```

### parser

`parser` 是解析原始数据的工具。它本身是一个函数，类型如下：

```js
// data 是DataView接收的原始内容，option 是执行parser时的传入参数，dataView 是当前进行 parser 的数据视图
export type Parser = (data: any, options: Object, dataView: DataView) => any;
```

使用示例如下：

```js
export interface ICsvParserOptions {
    delimiter?: string;
}
const csvParser = (data: string, option: ICsvParserOptions, dataView: DataView) => {
  /** ...*/
};
// 先对 parser，进行注册
dataSet.registerParser('csv', csvParser);
// 使用
dataView.parse(`year,group,value
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
`, {
    type: 'csv'
    option: {
      delimiter: ','
    }
  });
```

### transform

`parser` 是数据变换工具，同一个 `DataView` 可以有多个 `transform` ，它们会依次执行，下一个 `transform` 拿到的数据是上一个 `transform` 变换后的结果

类型如下：

```js
export type Transform = (data: any, options?: Object) => any;
type TransformName = string;
export interface ITransformOptions {
  type: TransformName;
  options?: Object;
  level?: number; // 如果配置了 level ，DataView 上的 transform 会按照level排序
}
```

使用示例如下：

```js
export interface IStatisticsOptions {
    fields: string[];
    operations: Array<'count' | 'max' | 'min' | 'mean' | 'average' | 'median' | 'mode' | 'product' | 'standardDeviation' | 'sum' | 'sumSimple' | 'variance'>;
    as?: string[];
    groupBy?: string;
}
const statisticsTransform = (data: string, option: IStatisticsOptions) => {
  /** ...*/
};
// 先对 transform 进行注册
dataSet.registerTransform('statistics', statisticsTransform);
// 使用
dataView.transform({
  type: 'statistics'
  option: {
    fields: ['year'],
    operations: ['average'],
    as: ['avg'],
    groupBy: 'group'
  }
});
```

### 使用示例

下面我们用一个例子来说明如何使用 DataSet 处理数据，并在图表中使用。

下方的例子中数据是某地区 3 年的的成年人口中 `accept same-sex relationships` 比例数据，一份是 50 岁以下的数据，一份是 50 岁以上的数据。我们将进行如下操作

1. 将 2 份 csv 数据分别解析，得到 2 个数据视图 dataView1 和 dataView2
2. 使用一个新数据视图 dataViewMerge ，依赖 dataView1 和 dataView2 ，将他们的数据合并。
3. 再创建一份新数据视图 dataViewAvg，对 2 中得到的数据进行统计，得到一份平均值数据。
4. 使用 dataViewMerge 和 dataViewAvg 绘制一份组合图，使用柱图表示原本的比例数据，用线绘制平均值。

```js
// 引用内容
import { DataSet, csvParser, dataViewParser, statistics } from '@visactor/vdataset';
// 创建 dataset 实例
const dataSet = new DataSet();
// 注册 parser，transform
dataSet.registerParser('csv', csvParser);
dataSet.registerParser('dataview', dataViewParser);
dataSet.registerTransform('statistics', statistics);

// 2份原始数据
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

// 解析2分原始数据
const dataView1 = new DataView(dataSet, { name: 'dataView1' });
dataView1.parse(dataLess50, { type: 'csv' });
const dataView2 = new DataView(dataSet, { name: 'dataView2' });
dataView2.parse(dataOver50, { type: 'csv' });

// 创建 dataViewMerge
const dataViewMerge = new DataView(dataSet, { name: 'dataViewMerge' });
// 令它引用 dataView1, dataView2
dataViewMerge.parse([dataView1, dataView2], { type: 'dataview' });
// 现在我们来自己实现一个 merge transform
const mergeDataViewTransform = (data: DataView[], opt) => {
  // 此时我们接收的 data 是一个数组 data = [dataView1,dataView2]
  const result = [];
  data.forEach(d => {
    // dataView 的 latestData 属性就是它的最终数据
    result.push(...d.latestData);
  });
  return result;
};
// 注册 merge transform
dataSet.registerTransform('mergeDataView', mergeDataViewTransform);
// 使用 merge transform 合并数据
dataViewMerge.transform({ type: 'mergeDataView' });

/**
 * 至此，dataViewMerge 数据处理已经完成了。
 * 最终数据的内容如下
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

// 创建平均值数据 令它引用 dataViewMerge
const dataViewAvg = new DataView(dataSet, { name: 'dataViewAvg' });
dataViewAvg.parse([dataViewMerge], { type: 'dataview' });
// 内置的 copy transform。从依赖的 dataView 上浅拷贝数据，只会重新创建数据数组，数据对象不变。
dataViewAvg.transform({ type: 'copyDataView' });
// 此时 dataViewAvg 与 dataViewMerge 中的数据内容相同
// 内置的 statistics transform 可以生成统计数据
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
 * 至此，dataViewAvg 数据处理已经完成了
 * 最终数据的内容如下
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
      dataId: 'dataViewMerge', // 使用 id 对应数据
      xField: 'year',
      yField: 'value',
      seriesField: 'group'
    },
    {
      type: 'line',
      dataId: 'dataViewAvg', // 使用 id 对应数据
      xField: 'year',
      yField: 'avg',
    },
  ],
  axes: [{ orient: 'left' }, { orient: 'bottom', type: 'band' }]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

```

### 依赖更新

关于依赖更新，在上方的例子中，如果需要进行数据更新，比如数据从 `[1990，1991，1993]` 增加到了 `[1990，1991，1993，1995，1997]` 只需要更新对应的 `dataView1` 和 `dataView2` 。图表使用的 `dataViewMerge` 和 `dataViewAvg` 会自动更新。图表内容也会发生对应的变化。

这是由于在 dataView 的依赖关系建立时，就会默认创建更新链路，当上方数据更新后，会自动通知下方数据更新。

我们可以通过在多个图表中使用同一个 DataSet 的方式，通过依赖更新，非常简单的实现基于数据的联动效果。
