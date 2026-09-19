# Series

## Basic Concepts

In data visualization, series is a basic concept, used to describe the way a set of data is presented in a chart. A series is usually composed of one or more groups of graphic elements, such as lineSeries usually composed of points and lines, and barSeries composed of rectangles.

A chart can contain multiple series, and each series can represent one or multiple sets of data based on its characteristics.

Graphic elements in a series establish a mapping relationship with data through their attributes to display data. For example, position, color, size, shape, etc. To give an example, a bubble chart uses the size of the points to represent the magnitude of the value, and the color represents the category of the data.

## Components of a Series

From the basic concept of a series, a series mainly consists of 3 parts:

- Data
- Graphic elements
- Mapping relationship between data and graphic elements

### Data

The data in a series is usually one or more sets of data, each with its own characteristics, such as data type, data structure, data content, data source, etc. The data can be associated with the series by configuring `dataId` or `dataIndex`.

### Graphic Elements

The graphic elements of a series vary according to the type of series. For example, lineSeries are usually composed of points and lines, while barSeries are composed of rectangles. The types of graphic elements are generated according to the fixed series type, and specific graphic element types will be introduced in detail in the series document.

### Mapping Relationship between Data and Graphic Elements

The mapping relationship is the core of the series, which determines how data is displayed in the chart. The default effect of the mapping relationship is to follow the series type, such as the mapping relationship of lineSeries is `xFIeld` and `yField` mapped to the `x` axis and `y` axis. The mapping relationship of pieSeries is `angleField` mapped to the `angle` axis.

In addition to the most basic mapping relationships, other styles of graphic elements can be bound to the relationship between data by configuring `style`. For more details, see the documentation on graphic elements in the tutorial.

## Using Series

With a clear chart type, using a series is very simple. Just configure the data and mapping relationship. For example, the following example uses a `bar` series to display the data.

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

After specifying the chart type `type` in the example, the chart series is fixed to `bar`. Then configure the data through `data`, configure the classification of the data through `seriesField`, and configure the position of the data through `xField` and `yField`.

Another situation is that when using a generic chart, the series can be configured through the series configuration. For example, the following example uses a generic chart to display the data.

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

In the above example, two series are configured through `series`, one is a `bar` series and the other is a `line` series. Specify the data using `dataId`, configure the position of the data using `xField` and `yField`, and configure the classification of the data using `seriesField`.
