# 一份基础的 spec

在前面的章节中，我们已经大致了解了如何快速绘制一张 VChart 图表。本教程将以分组柱状图为例，细致介绍 VChart 的一份基础的 spec 组成。一份基础的 spec 需包含以下部分：

1. `type` 图表类型
2. `data` 数据源
3. 数据映射，大部分情况下在直角坐标系中为 `xField` 和 `yField`，极坐标系下为 `categoryField` 和 `valueField`
4. 系列配置，VChart 的图表有 series 系列构成，系列下包含图元和 label，图元和 label 的配置都在系列配置中
5. 组件配置，如 `legends`、`axes` 等，除去组合图必须配置 `axes` 之外，其余图表的组件的配置其实是可选的，按需配置即可

## 1. 配置图表类型

在 VChart spec 中，我们首先需要指定图表的类型。于柱状图来说，需要将图表类型为 `'bar'`：

```json
{
  "type": "bar"
}
```

目前 VChart 支持的图表类型列表如下：

| 图表类型             | 说明          |
| -------------------- | ------------- |
| `'common'`           | 组合图        |
| `'area'`             | 面积图        |
| `'line'`             | 折线图        |
| `'bar'`              | 柱状图        |
| `'bar3d'`            | 3D 柱状图     |
| `'histogram'`        | 直方图        |
| `'histogram3d'`      | 3D 直方图     |
| `'rangeColumn'`      | 区间柱图      |
| `'rangeColumn3d'`    | 3D 区间柱图   |
| `'rangeArea'`        | 区间面积图    |
| `'map'`              | 地图          |
| `'pie'`              | 饼图          |
| `'pie3d'`            | 3D 饼图       |
| `'radar'`            | 雷达图        |
| `'rose'`             | 玫瑰图        |
| `'scatter'`          | 散点图        |
| `'sequence'`         | 时序图        |
| `'circularProgress'` | 环形进度条    |
| `'linearProgress'`   | 条形进度条    |
| `'wordCloud'`        | 词云          |
| `'wordCloud3d'`      | 3D 词云       |
| `'funnel'`           | 漏斗图        |
| `'funnel3d'`         | 3D 漏斗图     |
| `'waterfall'`        | 瀑布图        |
| `'boxPlot'`          | 箱型图        |
| `'gauge'`            | 仪表盘        |
| `'sankey'`           | 桑基图        |
| `'treemap'`          | 矩形树图      |
| `'sunburst'`         | 旭日图        |
| `'circlePacking'`    | circlePacking |
| `'heatmap'`          | 热力图        |

## 2. 数据源

数据是图表可视化的基础，我们需要在 spec 中指定数据源。通常情况下，数据以 JSON 格式表示，使用 `data` 字段指定。例如，我们可以将数据源指定为如下格式：

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

其中 `id` 字段用于标识数据源，`values` 字段用于指定数据源的数据。

## 3. 数据映射

接下来我们需要将数据映射到图的基本图形元素（marks）上。对于本教程的分组柱状图来说，我们指定 `xField`，`yField` 和 `seriesField`。其中 `xField`，`yField` 用于位置映射，`seriesField` 用于颜色映射

```json
{
  "xField": ["year", "type"],
  "yField": "value",
  "seriesField": "type"
}
```

## 4. 系列配置

柱状图对应 `'bar'` 系列，`'bar'` 系列包含 `'bar'` 图元和 label，我们可以对这些图元和 label 进行配置。更多关于系列的介绍详见[系列教程](../Chart_Concepts/Series/Composition_and_Effect_of_Series)。

### 4.1 图元样式配置

我们可以对 `'bar'` 图元进行样式配置，例如，我们可以为柱状图加上圆角：

```json
{
  "bar": {
    "style": {
      "cornerRadius": 4
    }
  }
}
```

### 4.2 图元标签配置

我们可以为 `'bar'` 图元加上 label，因为 label 默认不展示，所以我们需要将 label 的 `visible` 属性设置为 `true`。此外，我们还可以设置 label 的位置，例如，我们可以将 label 放置在柱状图的顶部：

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

## 5. 组件配置

VChart 还支持配置图表的各种组件，如坐标轴（axes）、图例(legends)、crosshair 和提示框（tooltip）等。目前 VChart 支持的组件有：

| 组件类型属性  | 组件说明     |
| ------------- | ------------ |
| `'axes'`      | 坐标轴       |
| `'legends'`   | 图例         |
| `'tooltip'`   | 提示框       |
| `'crosshair'` | crosshair    |
| `'brush'`     | 框选交互组件 |
| `'scrollbar'` | 滚动条       |
| `'dataZoom'`  | 数据筛选滑块 |
| `'player'`    | 播放器       |
| `'markLine'`  | 标记线       |
| `'markArea'`  | 标记区域     |
| `'markPoint'` | 标记点       |
| `'indicator'` | 指标卡       |
| `'title'`     | 标题         |

在本教程中，我们介绍如何配置图例和 crosshair。

### 5.1 配置图例

要显示图例，我们需要设置将图例的 `visible` 属性设置为 `true`。此外，我们还可以设置图例的位置，例如，我们可以将图例放置在图表顶部的起始位置：

```json
{
  "legends": {
    "visible": true,
    "orient": "top",
    "position": "start"
  }
}
```

### 5.2 配置 crosshair

与此同时，还可以配置横轴和纵轴上的 crosshair。例如，我们可以让横轴上的 crosshair 可见，而纵轴上的 crosshair 不可见：

```json
{
  "crosshair": {
    "xField": { "visible": true },
    "yField": { "visible": false }
  }
```

## 完整示例

结合以上部分内容，我们可以得到如下完整的 spec：

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

通过本教程，您已经了解了一份基础的 spec 配置组成，后面你可以尝试更改数据和对应的配置项，探索 VChart 的强大功能和灵活性，编绘出绚丽多彩的图表。祝您编码愉快！
