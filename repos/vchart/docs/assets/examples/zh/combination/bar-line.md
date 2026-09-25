---
category: demo
group: combination
title: 特殊轴效果的线柱组合图
keywords: commonChart
order: 22-8
cover: /vchart/preview/combination-bar-line_1.10.3.png
option: commonChart
---

# 线柱组合图

## 关键配置

- `type: 'common'` 声明为组合图类型
- `series` 属性中配置想要展示的系列
- `axes` 属性可以配置多个组件
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
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: 'Mon-Tue', type: 'a', y: 19 },
        { x: 'Tue-Web', type: 'a', y: 18 },
        { x: 'Wed-Thur', type: 'a', y: 16 },
        { x: 'Thur-Fri', type: 'a', y: 14 },
        { x: 'Fri-Sat', type: 'a', y: 12 },
        { x: 'Sat-Sun', type: 'a', y: 11 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: 'Mon-Tue', type: 'b', y: 16 },
        { x: 'Tue-Web', type: 'b', y: 17 },
        { x: 'Wed-Thur', type: 'b', y: 18 },
        { x: 'Thur-Fri', type: 'b', y: 20 },
        { x: 'Fri-Sat', type: 'b', y: 24 },
        { x: 'Sat-Sun', type: 'b', y: 26 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      dataIndex: 0,
      seriesField: 'type',
      dataIndex: 0,
      xField: 'x',
      yField: 'y'
    },
    {
      type: 'line',
      dataIndex: 1,
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false
    }
  ],
  axes: [
    { orient: 'left' },
    {
      orient: 'bottom',
      visible: true,
      domain: ['Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat', 'Sun'],
      label: { visible: true },
      type: 'band',
      // bandPadding: 0,
      // paddingInner: 1,
      // paddingOuter: 0
      trimPadding: true
    },
    {
      orient: 'bottom',
      visible: false,
      label: { visible: true },
      type: 'band',
      bandPadding: 0,
      paddingInner: 0,
      paddingOuter: 0
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

TODO
