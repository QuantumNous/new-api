# 系列

## 基本概念

在数据可视化中，series（系列）是一个基本的概念，用于描述一组数据在图表中的呈现方式。一个 series 通常由一组或多组图元组成，比如线系列（lineSeries）通常由点和线组成，柱系列（barSeries）由矩形组成。

在一个图表中可以包含多个 series，每个 series 基于自己的特性可以表示一份或多份数据。

系列中的图元通过它们的属性与数据建立映射关系，来展示数据。比如位置，颜色，大小，形状，等等。举一个例子，比如气泡图会通过点的大小来表示数值的大小，使用颜色表示数据的分类。

## 系列的组成

从系列的基本概念可知，系列主要有 3 部分组成

- 数据
- 图元
- 数据与图元的映射关系

### 数据

系列的数据通常是一组或多组数据，每组数据都有自己的特性，比如数据的类型，数据的结构，数据的内容，数据的来源等等。通过配置 `dataId` 或者 `dataIndex` 可以将数据与系列建立关联。

### 图元

系列的图元会根据系列的类型不同而不同。比如线系列通常由点和线组成，柱系列由矩形组成。图元的类型会系列序列的类型固定生成，具体的图元类型在系列的文档中会有详细介绍。

### 数据与图元的映射关系

映射关系是系列的核心，它决定了数据如何在图表中展示。映射关系的默认效果是跟随系列类型的，比如线系列的映射关系是 `xFIeld` 和 `yField` 映射到 `x` 轴和 `y` 轴。饼系列的映射关系是 `angleField` 映射到 `angle` 轴。

除了最基础的映射关系外，图元的其他样式可以通过 `style` 中配置的来绑定与数据的关系，具体可以看教程中[图元](./Mark)的文档。

## 系列的使用

在有明确图表类型的情况下，系列的使用是非常简单的。只需要配置好数据和映射关系即可。比如下面的例子，使用 `bar` 系列来展示数据。

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { date: 'Monday', class: 'classNo.1', score: 20 },
        { date: 'Monday', class: 'classNo.2', score: 30 },

        { date: 'Tuesday', class: 'classNo.1', score: 25 },
        { date: 'Tuesday', class: 'classNo.2', score: 28 }
      ]
    }
  ],
  seriesField: 'class',
  xField: ['date', 'class'],
  yField: 'score'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

例子中指定图表类型 `type` 后，图表的系列就被固定为 `bar` 。然后通过 `data` 配置数据，通过 `seriesField` 配置数据的分类，通过 `xField` 和 `yField` 配置数据的位置。

另一种情况是在通用图表配置了，可以通过 series 配置来配置系列。比如下面的例子，使用通用图表来展示数据。

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'type',
  data: [
    {
      id: 'dataBar',
      values: [
        { year: '1990', group: '18-34', value: 11.125 },
        { year: '1991', group: '18-34', value: 12.4 },
        { year: '1993', group: '18-34', value: 18.425 },
        { year: '1990', group: '35-64', value: 10.125 },
        { year: '1991', group: '35-64', value: 11.4 },
        { year: '1993', group: '35-64', value: 17.425 }
      ]
    },
    {
      id: 'dataLine',
      values: [
        { year: '1990', avg: 11.125 },
        { year: '1991', avg: 12.4 },
        { year: '1993', avg: 18.425 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      dataId: 'dataBar',
      xField: 'year',
      yField: 'value',
      seriesField: 'group'
    },
    {
      type: 'line',
      dataId: 'dataLine',
      xField: 'year',
      yField: 'avg'
    }
  ],
  axes: [{ orient: 'left' }, { orient: 'bottom', type: 'band' }]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

在上面的例子中，通过 `series` 配置了两个系列，一个是 `bar` 系列，一个是 `line` 系列。通过 `dataId` 来指定数据，通过 `xField` 和 `yField` 来配置数据的位置，通过 `seriesField` 来配置数据的分类。
