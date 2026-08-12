---
category: demo
group: combination
title: 基础组合图
keywords: commonChart
order: 22-8
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/combination/single-region.png
option: commonChart
---

# 基础组合图

## 关键配置

- `type: 'common'` 声明为组合图类型
- `series` 属性中配置想要展示的系列
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
        { x: '周一', type: '早餐', y: 15 },
        { x: '周一', type: '午餐', y: 25 },
        { x: '周二', type: '早餐', y: 12 },
        { x: '周二', type: '午餐', y: 30 },
        { x: '周三', type: '早餐', y: 15 },
        { x: '周三', type: '午餐', y: 24 },
        { x: '周四', type: '早餐', y: 10 },
        { x: '周四', type: '午餐', y: 25 },
        { x: '周五', type: '早餐', y: 13 },
        { x: '周五', type: '午餐', y: 20 },
        { x: '周六', type: '早餐', y: 10 },
        { x: '周六', type: '午餐', y: 22 },
        { x: '周日', type: '早餐', y: 12 },
        { x: '周日', type: '午餐', y: 19 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: '周一', type: '饮料', y: 22 },
        { x: '周二', type: '饮料', y: 43 },
        { x: '周三', type: '饮料', y: 33 },
        { x: '周四', type: '饮料', y: 22 },
        { x: '周五', type: '饮料', y: 10 },
        { x: '周六', type: '饮料', y: 30 },
        { x: '周日', type: '饮料', y: 50 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      dataIndex: 0,
      label: { visible: true },
      seriesField: 'type',
      dataIndex: 0,
      xField: ['x', 'type'],
      yField: 'y'
    },
    {
      type: 'line',
      dataIndex: 1,
      label: { visible: true },
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false
    }
  ],
  axes: [{ orient: 'left' }, { orient: 'bottom', label: { visible: true }, type: 'band' }],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

TODO
