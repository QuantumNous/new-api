---
category: demo
group: brush
title: 不规则框选
keywords: scatterChart,brush
order: 32-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/brush/polygon-brush.png
option: scatterChart#brush
---

# 不规则框选

框选组件允许用户在图表区域内以多选的形式任意图表图元。

## 关键配置

- `brushType` 属性声明为选框类型, 可选值为：

  - `'x'`: 横向选择
  - `'y'`: 纵向选择
  - `'rect'`: 矩形选框
  - `'polygon'`: 任意形状选框

- `inBrush` 属性声明为被选中图表图元的样式。除图元基本样式属性外，还提供下列属性：
  - `symbol`: 图元的图形类别（仅在被框选的图元类型为`'symbol'`时有效。
  - `symbolSize`: 图元的大小（仅在被框选的图元类型为`'symbol'`时有效。
  - `color`: 图元的颜色。
  - `colorAlpha`: 图元的透明度，范围`[0, 1]`。
- `outOfBrush` 属性声明为未被选中图表图元的样式。可配置的样式同上。

## 代码演示

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
  direction: 'horizontal',
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

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。
