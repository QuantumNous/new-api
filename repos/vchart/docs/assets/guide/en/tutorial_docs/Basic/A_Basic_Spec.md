# A Basic Spec

In the previous chapters, we have roughly learned how to quickly draw a VChart chart. This tutorial will take a Grouped Bar Chart as an example to give a detailed introduction to the basic composition of a VChart spec. A basic spec needs to include the following parts:

1. `type` chart type
2. `data` data source
3. Data mapping, in most cases, `xField` and `yField` in the Cartesian coordinate system, `categoryField` and `valueField` in the polar coordinate system
4. Series configuration, VChart charts are composed of series, each series contains graphic elements and labels, the configuration of graphic elements and labels is in the series configuration
5. Component configuration, such as `legends`, `axes`, etc., except that the axes must be configured for combined charts, the configuration of components for other charts is actually optional, configure as needed

## 1. Configure Chart Type

In VChart spec, we first need to specify the type of chart. For bar charts, we need to set the chart type to `'bar'`:

```json
{
  "type": "bar"
}
```

The currently supported chart types in VChart are as follows:

| Chart Type           | Description           |
| -------------------- | --------------------- |
| `'common'`           | Combined chart        |
| `'area'`             | Area chart            |
| `'line'`             | Line chart            |
| `'bar'`              | Bar chart             |
| `'bar3d'`            | 3D bar chart          |
| `'histogram'`        | Histogram             |
| `'histogram3d'`      | 3D histogram          |
| `'rangeColumn'`      | Range column chart    |
| `'rangeColumn3d'`    | 3D range column chart |
| `'rangeArea'`        | Range area chart      |
| `'map'`              | Map                   |
| `'pie'`              | Pie chart             |
| `'pie3d'`            | 3D pie chart          |
| `'radar'`            | Radar chart           |
| `'rose'`             | Rose chart            |
| `'scatter'`          | Scatter chart         |
| `'sequence'`         | Sequence chart        |
| `'circularProgress'` | Circular progress bar |
| `'linearProgress'`   | Linear progress bar   |
| `'wordCloud'`        | Word cloud            |
| `'wordCloud3d'`      | 3D word cloud         |
| `'funnel'`           | Funnel chart          |
| `'funnel3d'`         | 3D funnel chart       |
| `'waterfall'`        | Waterfall chart       |
| `'boxPlot'`          | Box plot              |
| `'gauge'`            | Gauge                 |
| `'sankey'`           | Sankey chart          |
| `'treemap'`          | Treemap               |
| `'sunburst'`         | Sunburst              |
| `'circlePacking'`    | Circle Packing        |
| `'heatmap'`          | Heatmap               |

## 2. Data Source

Data is the basis of chart visualization, so we need to specify the data source in the spec. In most cases, data is represented in JSON format, specified by the `data` field. For example, we can set the data source as follows:

```json
{
  "data": [
    {
      "id": "barData",
      "values": [
        { "type": "A", "year": "1930", "value": 129 },
        { "type": "A", "year": "1940", "value": 133 },
        { "type": "A", "year": "1950", "value": 130 },
        { "type": "A", "year": "1960", "value": 126 },
        { "type": "A", "year": "1970", "value": 117 },
        { "type": "A", "year": "1980", "value": 114 },
        { "type": "A", "year": "1990", "value": 111 },
        { "type": "A", "year": "2000", "value": 89 },
        { "type": "A", "year": "2010", "value": 80 },
        { "type": "A", "year": "2018", "value": 80 },
        { "type": "B", "year": "1930", "value": 22 },
        { "type": "B", "year": "1940", "value": 13 },
        { "type": "B", "year": "1950", "value": 25 },
        { "type": "B", "year": "1960", "value": 29 },
        { "type": "B", "year": "1970", "value": 38 },
        { "type": "B", "year": "1980", "value": 41 },
        { "type": "B", "year": "1990", "value": 57 },
        { "type": "B", "year": "2000", "value": 87 },
        { "type": "B", "year": "2010", "value": 98 },
        { "type": "B", "year": "2018", "value": 99 }
      ]
    }
  ]
}
```

The `id` field is used to identify the data source, and the `values` field is used to specify the data of the data source.

## 3. Data Mapping

Next, we need to map the data to the basic graphic elements (marks) of the chart. For the grouped bar chart in this tutorial, we specify `xField`, `yField`, and `seriesField`. The `xField` and `yField` are used for position mapping, and the `seriesField` is used for color mapping:

```json
{
  "xField": ["year", "type"],
  "yField": "value",
  "seriesField": "type"
}
```

## 4. Series Configuration

The bar chart corresponds to the `'bar'` series. The `'bar'` series contains `'bar'` graphic elements and labels, which can be configured. For more information about series configuration, please refer to [Series Tutorial](../Chart_Concepts/Series/Composition_and_Effect_of_Series).

### 4.1 Graphic Element Style Configuration

We can configure the style of the `'bar'` graphic elements. For example, we can add rounded corners to the bar chart:

```json
{
  "bar": {
    "style": {
      "cornerRadius": 4
    }
  }
}
```

### 4.2 Graphic Element Label Configuration

We can add labels to the `'bar'` graphic elements. Since the labels are not displayed by default, we need to set the `visible` attribute of the labels to `true`. In addition, we can also set the position of the labels, for example, we can place the labels at the top of the bar chart:

```json
{
  "bar": {
    "label": {
      "visible": true,
      "position": "top"
    }
  }
}
```

## 5. Component Configuration

VChart also supports configuring various components of the chart, such as axes, legends, crosshair, tooltip, etc. VChart currently supports the following components:

| Component Type Property | Component Description               |
| ----------------------- | ----------------------------------- |
| `'axes'`                | Axes                                |
| `'legends'`             | Legends                             |
| `'tooltip'`             | Tooltip                             |
| `'crosshair'`           | Crosshair                           |
| `'brush'`               | Box selection interaction component |
| `'scrollbar'`           | Scrollbar                           |
| `'dataZoom'`            | Data filtering slider               |
| `'player'`              | Player                              |
| `'markLine'`            | Mark line                           |
| `'markArea'`            | Mark area                           |
| `'markPoint'`           | Mark point                          |
| `'indicator'`           | Indicator card                      |
| `'title'`               | Title                               |

In this tutorial, we will introduce how to configure legends and crosshair.

### 5.1 Configure Legends

To display legends, we need to set the `visible` attribute of legends to `true`. In addition, we can also set the position of the legends, for example, we can place the legends at the top and the start position of the chart:

```json
{
  "legends": {
    "visible": true,
    "orient": "top",
    "position": "start"
  }
}
```

### 5.2 Configure Crosshair

At the same time, we can also configure crosshair on the horizontal and vertical axes. For example, we can make the crosshair on the horizontal axis visible, while the crosshair on the vertical axis invisible:

```json
{
  "crosshair": {
    "xField": { "visible": true },
    "yField": { "visible": false }
  }
}
```

## Complete Example

Combining the above parts, we can get the following complete spec:

```javascript livedemo
const spec = {
  // 声明图表类型
  type: 'bar',
  // 声明数据
  data: [
    {
      id: 'barData',
      values: [
        { type: 'A', year: '1930', value: 129 },
        { type: 'A', year: '1940', value: 133 },
        { type: 'A', year: '1950', value: 130 },
        { type: 'A', year: '1960', value: 126 },
        { type: 'A', year: '1970', value: 117 },
        { type: 'A', year: '1980', value: 114 },
        { type: 'A', year: '1990', value: 111 },
        { type: 'A', year: '2000', value: 89 },
        { type: 'A', year: '2010', value: 80 },
        { type: 'A', year: '2018', value: 80 },
        { type: 'B', year: '1930', value: 22 },
        { type: 'B', year: '1940', value: 13 },
        { type: 'B', year: '1950', value: 25 },
        { type: 'B', year: '1960', value: 29 },
        { type: 'B', year: '1970', value: 38 },
        { type: 'B', year: '1980', value: 41 },
        { type: 'B', year: '1990', value: 57 },
        { type: 'B', year: '2000', value: 87 },
        { type: 'B', year: '2010', value: 98 },
        { type: 'B', year: '2018', value: 99 }
      ]
    }
  ],
  // 声明 x 轴字段，当存在分组时
  xField: ['year', 'type'],
  // 声明 y 轴字段
  yField: 'value',
  // 用于颜色映射
  seriesField: 'type',
  // 系列配置: 图元样式
  bar: {
    style: {
      cornerRadius: 4
    }
  },
  // 系列配置: 图元标签
  label: {
    visible: true,
    position: 'top'
  },
  // 配置图例
  legends: {
    visible: true,
    orient: 'top',
    position: 'start'
  },
  // 配置 crosshair
  crosshair: {
    xField: { visible: true },
    yField: { visible: false }
  },
  // 配置坐标轴，对于 type 不为 'common'(即组合图)的图表，轴的配置会默认生成，所以如果不需要特殊的定制，也可以不声明
  axes: [{ orient: 'bottom' }, { orient: 'left', domainLine: { visible: true } }]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

Through this tutorial, you have already learned the composition of a basic spec configuration. In the
