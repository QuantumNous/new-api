---
category: examples
group: range column chart
title: 区间柱状图
keywords: rangeColumnChart,comparison,rectangle,trend
order: 4-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/range-column-chart/range-column.png
option: rangeColumnChart
---

# 区间柱状图

区间柱状图。通过绘制每个数据点的两个 Y 值来显示一系列数据，每个 Y 值被绘制为柱的上限和下限。

## 关键配置

- `xField` 属性声明为分类字段
- `yField` 属性配置为最小值数值属性与最大值数值属性共同构成的数组
- `label.position` 可以配置为 `middle` 、 `start`、 `end`、 `bothEnd`, 分别表示标签置于中间、起点、终点和两端, 默认为`middle`

## 代码演示

```javascript livedemo
const spec = {
  type: 'rangeColumn',
  data: [
    {
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
  xField: 'type',
  yField: ['min', 'max'],
  label: {
    position: 'bothEnd'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## 相关教程

[区间柱状图](link)
