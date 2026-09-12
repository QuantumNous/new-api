# Brush 框选

Brush 是 VChart 提供的一款交互组件，该组件可以帮助用户在图表中对数据进行选取，方便用户进一步分析或操作数据。本教程主要讲解 Brush 的相关概念以及组成，关于 Brush 更加详细的配置及示例，详见[配置项文档](../../../option)及[示例](../../../example)页面。

## 组成

Brush 组件主要有一个框选区域组成，提供了丰富的框选类型、样式以及交互支持，同时也提供了对应的事件（`brushChange`，详见[事件 API](/vchart/api/API/event)）。

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/48c337ece11d289fc4644a21b.png" alt="Brush 图示">
</div>

### 框选类型

Brush 提供了 4 种常见的框选类型，用户可以根据实际需求选择合适的类型：

- 'x': 横向选择，仅在 X 轴方向上进行数据选取
- 'y': 纵向选择，仅在 Y 轴方向上进行数据选取
- 'rect': 矩形选框，用户可以在图表中画出矩形框，选取其中的数据
- 'polygon': 任意形状选框，用户可以在图表中自由画出多边形框，选取其中的数据

### 样式与交互

Brush 支持对选框内外的样式进行设置，如颜色、透明度等。同时也可以实现一些交互效果，例如选中数据的高亮显示。

## 示例

接下来我们通过一个具体的示例来演示如何在 VChart 中使用 Brush 框选组件。

首先我们需要准备一个散点图表，使用以下代码定义散点图表的 spec：

```javascript
const spec = {
  type: 'scatter',
  data: [
    {
      values: [
        { x: 936196, size: 83431, y: 1371, type: '技术', area: '东北' },
        { x: 1270911, size: 219815, y: 5590, type: '办公用品', area: '中南' }
        // ... 更多数据项
      ]
    }
  ],
  xField: 'x',
  yField: 'y',
  seriesField: 'type',
  sizeField: 'size',
  size: [10, 25],
  shapeField: 'type',
  shape: ['circle', 'triangle'],
  direction: 'horizontal',
  axes: [
    { orient: 'left', range: { min: 0 }, type: 'linear' },
    { orient: 'bottom', label: { visible: true }, type: 'linear' }
  ]
};
```

现在，我们要在这个散点图中添加框选功能，只需要在 spec 中加入 brush 配置项，并设置相应参数即可：

```javascript
spec.brush = {
  brushType: 'polygon', // 设置框选类型为任意形状选框
  inBrush: {
    colorAlpha: 1 // 选框内数据颜色透明度
  },
  outOfBrush: {
    colorAlpha: 0.2 // 选框外数据颜色透明度
  }
};
```

```javascript livedemo
const spec = {
  type: 'scatter',
  data: [
    {
      values: [
        { x: 936196, size: 83431, y: 1371, type: 'Technology', area: 'Northeast' },
        { x: 1270911, size: 219815, y: 5590, type: 'office supplies', area: 'Zhongnan' },
        { x: 453898, size: 19061, y: 727, type: 'Technology', area: 'Southwest' },
        { x: 919743, size: 148800, y: 1199, type: 'furniture', area: 'North China' },
        { x: 1676224, size: 163453, y: 2517, type: 'furniture', area: 'East China' },
        { x: 1466575, size: 251487, y: 2087, type: 'Technology', area: 'Zhongnan' },
        { x: 824673, size: 86067, y: 3622, type: 'office supplies', area: 'Northeast' },
        { x: 230956, size: 24016, y: 347, type: 'Technology', area: 'Northwest' },
        { x: 1599653, size: 228179, y: 2183, type: 'Technology', area: 'East China' },
        { x: 745813, size: 137265, y: 3020, type: 'office supplies', area: 'North China' },
        { x: 267870, size: 49633, y: 970, type: 'office supplies', area: 'Northwest' },
        { x: 1408628, size: 215585, y: 6341, type: 'office supplies', area: 'East China' },
        { x: 781743, size: 144986, y: 927, type: 'Technology', area: 'North China' },
        { x: 501533, size: 29303, y: 814, type: 'furniture', area: 'Southwest' },
        { x: 920698, size: 72692, y: 1470, type: 'furniture', area: 'Northeast' },
        { x: 316212, size: 24903, y: 468, type: 'furniture', area: 'Northwest' },
        { x: 1399928, size: 199582, y: 2023, type: 'furniture', area: 'Zhongnan' },
        { x: 347692, size: 49272, y: 1858, type: 'office supplies', area: 'Southwest' }
      ]
    }
  ],
  xField: 'x',
  yField: 'y',
  seriesField: 'type',
  sizeField: 'size',
  size: [10, 25],
  shapeField: 'type',
  shape: ['circle', 'triangle'],
  axes: [
    { orient: 'left', range: { min: 0 }, type: 'linear' },
    { orient: 'bottom', label: { visible: true }, type: 'linear' }
  ],
  legends: [
    {
      visible: true,
      orient: 'left',
      position: 'start',
      title: {
        visible: true,
        style: {
          text: 'title'
        }
      },
      item: {
        visible: true
      }
    }
  ],
  brush: {
    brushType: 'polygon',
    inBrush: {
      colorAlpha: 1
    },
    outOfBrush: {
      colorAlpha: 0.2
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID, animation: false });
vchart.renderSync();
```
