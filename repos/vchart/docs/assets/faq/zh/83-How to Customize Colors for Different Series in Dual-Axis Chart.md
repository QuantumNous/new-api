# 线、柱双轴图中，如何自定义不同系列的颜色？

## 问题描述

I have a dual-axis chart consisting of a line graph and a bar graph. There can be multiple lines in the line graph and multiple bars in the bar graph.
In a dual-axis chart consisting of both line and bar graphs, how freely define the colors and other details for each bar and line?

## 解决方案

VChart 图表提供了对应的能力，支持通过配置 scale 来自由控制数据与值的映射关系。在双轴图图，控制颜色就可以使用 scale 来控制各个图形字段使用特定的颜色值。
更具体的配置规则，可参考：https://visactor.io/vchart/option/barChart#scales.domain

## 代码示例

```javascript livedemo
const spec = {
  type: 'common',
  data: [
    {
      id: 'id0',
      values: [
        { x: 'Monday', type: 'Breakfast', y: 15 },
        { x: 'Monday', type: 'Lunch', y: 25 },
        { x: 'Tuesday', type: 'Breakfast', y: 12 },
        { x: 'Tuesday', type: 'Lunch', y: 30 },
        { x: 'Wednesday', type: 'Breakfast', y: 15 },
        { x: 'Wednesday', type: 'Lunch', y: 24 },
        { x: 'Thursday', type: 'Breakfast', y: 10 },
        { x: 'Thursday', type: 'Lunch', y: 25 },
        { x: 'Friday', type: 'Breakfast', y: 13 },
        { x: 'Friday', type: 'Lunch', y: 20 },
        { x: 'Saturday', type: 'Breakfast', y: 10 },
        { x: 'Saturday', type: 'Lunch', y: 22 },
        { x: 'Sunday', type: 'Breakfast', y: 12 },
        { x: 'Sunday', type: 'Lunch', y: 19 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: 'Monday', type: 'Beverage', y: 22 },
        { x: 'Tuesday', type: 'Beverage', y: 43 },
        { x: 'Wednesday', type: 'Beverage', y: 33 },
        { x: 'Thursday', type: 'Beverage', y: 22 },
        { x: 'Friday', type: 'Beverage', y: 10 },
        { x: 'Saturday', type: 'Beverage', y: 30 },
        { x: 'Sunday', type: 'Beverage', y: 50 }
      ]
    }
  ],
  color: {
    type: 'ordinal',
    field: 'type',
    domain: ['Breakfast', 'Lunch', 'Beverage'],
    range: ['lightPink', 'lightBlue', 'purple']
  },
  series: [
    {
      type: 'bar',
      id: 'bar',
      dataIndex: 0,
      label: { visible: true },
      seriesField: 'type',
      xField: ['x', 'type'],
      yField: 'y'
    },
    {
      type: 'line',
      id: 'line',
      dataIndex: 1,
      label: { visible: true },
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false
    }
  ],
  axes: [
    { orient: 'left', seriesIndex: [0] },
    { orient: 'right', seriesId: ['line'], grid: { visible: false } },
    { orient: 'bottom', label: { visible: true }, type: 'band' }
  ],
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

## 相关文档

- [github](https://github.com/VisActor/VChart)
- [VChart Scale 教程](https://visactor.io/vchart/option/barChart#scales.domain)
