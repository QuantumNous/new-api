---
category: demo
group: combination
title: 线饼组合图
keywords: commonChart
order: 22-5
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/combination/line-pie.png
option: commonChart
---

# 线饼组合图

## 关键配置

- `type: 'common'` 声明为组合图类型
- `layout` 属性声明组合图自定义布局
  - `layout.type`属性声明布局类型, `grid`为行列布局
  - `layout.col`属性声明列数（注意: 所有图表中的独立元素都需要独占一列, 比如数据轴或其他组件 和 图表系列需要各占一列）
  - `layout.row`属性声明行数（注意: 同上）
  - `layout.col`属性指定列宽, 支持以`{ index: xx, size: xx }`的方式指定, `index`表示列所在的索引, `size`指列宽
  - `layout.row`属性指定行高, 支持以`{ index: xx, size: xx }`的方式指定, `index`表示行所在的索引, `size`指行高
  - `layout.elements`属性声明布局单元的 ID 以便数据系列与布局 d 单位绑定. 以`{modelId: xx, row: xx, col: xx}`的方式声明, 其中`modelId`表示布局单元的 ID 名, `row`和`col`分别表示布局单元所在行和列的索引.

## 代码演示

```javascript livedemo
const spec = {
  type: 'common',
  padding: {
    top: 10
  },
  layout: {
    type: 'grid',
    col: 2,
    row: 4,
    elements: [
      {
        modelId: 'legend',
        col: 0,
        colSpan: 2,
        row: 0
      },
      {
        modelId: 'pie-region',
        col: 0,
        colSpan: 2,
        row: 1
      },
      {
        modelId: 'axis-left',
        col: 0,
        row: 2
      },
      {
        modelId: 'line-region',
        col: 1,
        row: 2
      },
      {
        modelId: 'axis-bottom',
        col: 1,
        row: 3
      }
    ]
  },
  region: [
    {
      id: 'pie-region',
      height: '40%'
    },
    {
      id: 'line-region'
    }
  ],
  legends: {
    visible: true,
    orient: 'top',
    id: 'legend',
    regionId: ['pie-region', 'line-region']
  },
  series: [
    {
      regionId: 'pie-region',
      type: 'pie',
      valueField: 'value',
      categoryField: 'type',
      data: {
        id: 'pie',
        values: [
          { type: 'a', value: 10 },
          { type: 'b', value: 20 }
        ]
      },
      seriesField: 'type'
    },
    {
      regionId: 'line-region',
      type: 'line',
      xField: 'x',
      yField: 'y',
      data: {
        id: 'line',
        values: [
          { x: '1', y: 10, type: 'a' },
          { x: '1', y: 20, type: 'b' },
          { x: '2', y: 30, type: 'a' },
          { x: '2', y: 40, type: 'b' }
        ]
      },
      seriesField: 'type'
    }
  ],
  axes: [
    {
      id: 'axis-left',
      regionId: 'line-region',
      orient: 'left'
    },

    {
      id: 'axis-bottom',
      regionId: 'line-region',
      orient: 'bottom'
    }
  ],
  tooltip: {
    dimension: {
      visible: true
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
vchart.on('dimensionHover', {}, params => {
  console.log(params);
});
// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

TODO
