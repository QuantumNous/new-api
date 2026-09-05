# 能否给数据添加平均值横线？

## 问题描述

在使用 VChart 图表库时，能否做到类似于下图的效果，在图表中添加标注线表示数据的平均值？
[markline average](/vchart/faq/7-0.png)

## 解决方案

VChart 有着丰富的数据标注能力，对于您描绘的场景，只需要在 markLine 中配置`x: 'average'`即可。

## 代码示例

```javascript livedemo
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
  markLine: [
    {
      y: 'average',
      label: {
        visible: true,
        position: 'insideEndTop',
        text: 'Average Country',
        style: {
          fill: '#000'
        },
        labelBackground: {
          visible: false
        }
      }
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

window['vchart'] = vchart;
```

## 相关文档

- [图表标注线 demo](https://visactor.io/vchart/demo/marker/mark-line-axis)
- [图表标注教程](https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/marker)
- [相关 api](https://visactor.io/vchart/option/barChart#markLine.y)
- [github](https://github.com/VisActor/VChart)
