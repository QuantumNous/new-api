---
title: 7. 如何调整柱状图的柱间距</br>
---
## 问题标题

如何调整柱状图的柱间距</br>


## 问题描述

如何调整柱状图的柱间距？</br>


## 解决方案 

在 VChart 上提供了如下配置用于调整柱子间距：</br>
1. `axes` 配置上，为 `type: 'band'` 类型的轴提供了 [`paddingInner`](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FbarChart-axes-band%23paddingInner(number%257Cnumber%255B%255D)) 和 [`paddingOuter`](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FbarChart-axes-band%23paddingOuter(number%257Cnumber%255B%255D)) 属性，用于配置组内和组外间距</br>
1. 对于分组柱图，还可以使用 [`**barGapInGroup**`](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FbarChart%23barGapInGroup)** **属性调整分组柱图中各个分组内的柱子间距，可以设置绝对的像素值，也可以使用百分比（如 '10%'）。</br>
## 代码示例  

### `barGapInGroup`

```
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { type: 'Autocracies', year: '1930', value: 129 },
        { type: 'Autocracies', year: '1940', value: 133 },
        { type: 'Autocracies', year: '1950', value: 130 },
        { type: 'Autocracies', year: '1960', value: 126 },
        { type: 'Autocracies', year: '1970', value: 117 },
        { type: 'Autocracies', year: '1980', value: 114 },
        { type: 'Autocracies', year: '1990', value: 111 },
        { type: 'Autocracies', year: '2000', value: 89 },
        { type: 'Autocracies', year: '2010', value: 80 },
        { type: 'Autocracies', year: '2018', value: 80 },
        { type: 'Democracies', year: '1930', value: 22 },
        { type: 'Democracies', year: '1940', value: 13 },
        { type: 'Democracies', year: '1950', value: 25 },
        { type: 'Democracies', year: '1960', value: 29 },
        { type: 'Democracies', year: '1970', value: 38 },
        { type: 'Democracies', year: '1980', value: 41 },
        { type: 'Democracies', year: '1990', value: 57 },
        { type: 'Democracies', year: '2000', value: 87 },
        { type: 'Democracies', year: '2010', value: 98 },
        { type: 'Democracies', year: '2018', value: 99 }
      ]
    }
  ],
  xField: ['year', 'type'],
  yField: 'value',
  seriesField: 'type',
  legends: {
    visible: true,
    orient: 'top',
    position: 'start'
  },
  barWidth: 10,
  barGapInGroup: 0
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
### `paddingInner`

```
const spec = {
  type: 'bar',
  color: ['#becef3', '#6a8edc', '#77caeb', '#52c93b', '#d3f5e8'],
  data: [
    {
      id: 'barData',
      values: [
        { type: 'A', year: '2000', value: 25 },
        { type: 'A', year: '2010', value: 28 },
        { type: 'A', year: '2018', value: 18 },
        { type: 'B', year: '2000', value: 23 },
        { type: 'B', year: '2010', value: 32 },
        { type: 'B', year: '2018', value: 22 },
        { type: 'C', year: '2000', value: 18 },
        { type: 'C', year: '2010', value: 18 },
        { type: 'C', year: '2018', value: 18 },
        { type: 'D', year: '2000', value: 15 },
        { type: 'D', year: '2010', value: 22 },
        { type: 'D', year: '2018', value: 19 },
        { type: 'E', year: '2000', value: 5 },
        { type: 'E', year: '2010', value: 12 },
        { type: 'E', year: '2018', value: 5 }
      ]
    }
  ],
  xField: ['year', 'type'],
  yField: 'value',
  seriesField: 'type',
  axes: [
    {
      orient: 'bottom',
      paddingInner: 0.3
    }
  ],
  bar: {
    style: {
      fillOpacity: 0.9
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## 结果展示 

*  使用 `barGapInGroup`: https://visactor.io/vchart/demo/bar-chart/group-bar-with-barGapInGroup</br>
*  使用 `paddingInner`: https://visactor.io/vchart/demo/bar-chart/group-bar-with-padding</br>


## 相关文档

demo：</br>
https://visactor.io/vchart/demo/bar-chart/group-bar-with-barGapInGroup , </br>
https://visactor.io/vchart/demo/bar-chart/group-bar-with-padding</br>
API：</br>
https://visactor.io/vchart/option/barChart-axes-band#paddingInner(number%7Cnumber%5B%5D)</br>
https://visactor.io/vchart/option/barChart-axes-band#paddingOuter(number%7Cnumber%5B%5D)</br>
https://visactor.io/vchart/option/barChart#barGapInGroup</br>
github：github.com/VisActor/VChart/</br>



