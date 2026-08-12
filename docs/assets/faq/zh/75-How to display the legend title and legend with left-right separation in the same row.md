# 如何实现图例的标题和 图例左右分开显示？

## 问题描述

我想给图例新增一些文字描述，期望在图表底部新增一个图例和图例的文字描述。预期的布局效果是，文字左对齐，图例右对齐，并且文字和图例在同一行。
有什么图表库可以实现这种比较特殊定制的逻辑吗？

## 解决方案

VChart 的图例组件和标题组件提供了绝对定位的布局方式，通过设置 `layoutType:'absolute'`即可开启该布局模式。
随后为图表设置足够的 padding，将标题组件放在左下角，图例组件放在右下角，即可实现让图例的标题和图例左右分开显示。

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
  padding: [12, 12, 40, 12],
  legends: {
    visible: true,
    orient: 'top',
    position: 'start',
    layoutType: 'absolute',
    bottom: -40,
    right: 12,
    padding: 0
  },
  title: {
    visible: true,
    text: 'Two Series Category',
    layoutType: 'absolute',
    bottom: -40,
    left: 12,
    textStyle: {
      fontSize: 12
    },
    padding: 0
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关文档

- [github](https://github.com/VisActor/VChart)
- [VChart 标题组件配置文档](https://visactor.io/vchart/option/barChart#title.layoutType)
- [VChart 图例组件配置文档](https://visactor.io/vchart/option/barChart-legends-discrete#layoutType)
