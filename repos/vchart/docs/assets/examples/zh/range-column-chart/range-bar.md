---
category: examples
group: range column chart
title: 区间条形图
keywords: rangeColumnChart,comparison,rectangle,trend
order: 4-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/range-column-chart/range-bar.png
option: rangeColumnChart
---

# 区间条形图

区间条形图。通过绘制每个数据点的两个 X 值来显示一系列数据，每个 X 值被绘制为条的上限和下限。

## 关键配置

- `direction` 属性配置为 'horizontal'
- `xField` 属性配置为最小值数值属性与最大值数值属性共同构成的数组
- `yField` 属性声明为分类字段
- `label.position` 可以配置为 `middle` 、 `start`、 `end`、 `bothEnd`, 分别表示标签置于中间、起点、终点和两端, 默认为`middle`

## 代码演示

```javascript livedemo
const spec = {
  type: 'rangeColumn',
  data: [
    {
      id: 'data0',
      values: [
        { type: 'Category One', min: 76, max: 100 },
        { type: 'Category Two', min: 56, max: 108 },
        { type: 'Category Three', min: 38, max: 129 },
        { type: 'Category Four', min: 58, max: 155 },
        { type: 'Category Five', min: 45, max: 120 },
        { type: 'Category Six', min: 23, max: 99 },
        { type: 'Category Seven', min: 18, max: 56 },
        { type: 'Category Eight', min: 18, max: 34 }
      ]
    }
  ],
  direction: 'horizontal',
  yField: 'type',
  xField: ['min', 'max'],
  label: {
    visible: true
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[区间柱状图](link)
