# 如何禁用图例的默认交互行为？

## 问题描述

移动端展示图表时，为了方便用户阅读，会将图表的图例扩大。但几乎每个图表库的图例组件都会默认给图例设置默认的交互行为，例如在点击时过滤数据。

在手指滑动时容易误触图例的默认交互，如何将图表的图例交互取消掉？

## 解决方案

VChart 中为可交互的图元或组件提供了 interactive 配置用来控制启用或禁用交互功能，例如图例、图表标注、各种类型的图元等。
这个配置虽然默认开启的，但用户可以自己控制图表的交互行为。

## 代码示例

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { type: 'Autocracies', year: '1960', value: 126 },
        { type: 'Autocracies', year: '1970', value: 117 },
        { type: 'Autocracies', year: '1980', value: 114 },
        { type: 'Autocracies', year: '1990', value: 111 },
        { type: 'Autocracies', year: '2000', value: 89 },
        { type: 'Autocracies', year: '2010', value: 80 },
        { type: 'Autocracies', year: '2018', value: 80 },
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
    orient: 'bottom',
    position: 'middle',
    interactive: false
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关文档

- [github](https://github.com/VisActor/VChart)
- [VChart 图例 教程](https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Legend)
- [VChart 图例 配置](https://visactor.io/vchart/option/barChart-legends-discrete#interactive)
