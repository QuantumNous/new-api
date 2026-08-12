---
category: demo
group: brush
title: 矩形关联框选
keywords: scatterChart,brush
order: 32-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/brush/rect-linked-brush.png
option: commonChart#brush
---

# 矩形关联框选

框选组件允许用户在图表区域内以多选的形式任意图表图元。

## 关键配置

- `brushType` 属性声明为选框类型, 可选值为：

  - `'x'`: 横向选择
  - `'y'`: 纵向选择
  - `'rect'`: 矩形选框
  - `'polygon'`: 任意形状选框

- `brushLinkSeriesIndex` 属性声明为联动框选的系列索引，配后被联动的系列将会跟随主系列一同被高亮。

- `inBrush` 属性声明为被选中图表图元的样式。除图元基本样式属性外，还提供下列属性：
  - `symbol`: 图元的图形类别（仅在被框选的图元类型为`'symbol'`时有效。
  - `symbolSize`: 图元的大小（仅在被框选的图元类型为`'symbol'`时有效。
  - `color`: 图元的颜色。
  - `colorAlpha`: 图元的透明度，范围`[0, 1]`。
- `outOfBrush` 属性声明为未被选中图表图元的样式。可配置的样式同上。

## 代码演示

```javascript livedemo
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/brush-data.json');
const dataBrush = await response.json();

const row = 4;
const col = 4;
const region = [];
const layoutElements = [];
const series = [];
const axes = [];
const rowHeight = [];
for (let k = 0; k < row * col; k++) {
  region.push({
    id: `${k}_Region`
  });

  const seriesRow = Math.floor(k / col) + Math.floor(k / col);
  const seriesCol = k - Math.floor(k / col) * col;

  // 系列行
  layoutElements.push({
    row: seriesRow,
    col: seriesCol + seriesCol + 1,
    modelId: `${k}_Region`
  });

  series.push({
    id: `${k}_Region`,
    type: 'scatter',
    xField: 'x',
    yField: 'y',
    seriesField: 'type',
    data: { id: `${k}_Data`, values: dataBrush[k] },
    regionId: `${k}_Region`,
    size: 5
  });

  axes.push({
    id: `${k}_Left`,
    orient: 'left',
    regionId: `${k}_Region`,
    seriesId: [`${k}_Region`],
    zero: false
  });

  layoutElements.push({
    row: seriesRow,
    col: seriesCol + seriesCol,
    modelId: `${k}_Left`
  });

  axes.push({
    id: `${k}_Bottom`,
    orient: 'bottom',
    regionId: `${k}_Region`,
    seriesId: [`${k}_Region`],
    type: 'linear',
    zero: false
  });

  layoutElements.push({
    row: seriesRow + 1,
    col: seriesCol + seriesCol + 1,
    modelId: `${k}_Bottom`
  });

  if (seriesCol === 0) {
    rowHeight.push({
      index: seriesRow + 1,
      size: 30
    });
  }
}

const spec = {
  type: 'common',
  padding: 30,
  region,
  layout: {
    type: 'grid',
    col: col * 2,
    row: row * 2,
    elements: layoutElements,
    rowHeight
  },
  axes,
  tooltip: false,
  series,
  brush: {
    seriesIndex: Array.from({ length: 16 }, (v, k) => k),
    brushType: 'rect',
    brushLinkSeriesIndex: Array.from({ length: 16 }, (v, k) => k),
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

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。
