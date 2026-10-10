# 如何给图表添加标题？

## 问题描述

类似[官网示例](https://visactor.io/vchart/demo/line-chart/basic-line)这样的折线图，我希望给图表上方添加标题描述，该如何配置？

## 解决方案

在 VChart 中，只需要配置 `title.text`（标题文本）和 `title.subtext`（副标题文本）即可。
另外，你可以通过 `title.textStyle` 和 `title.subtextStyle` 配置来分别调整标题的样式。

```js
title: {
    text: 'Line chart',
    subtext:
      'The line chart is a simple, two-dimensional chart with an X and Y axis, each point representing a single value.',
    textStyle: {
      fontSize: 20
    },
    subtextStyle: {
      fontStyle: 'italic'
    }
}
```

## 代码示例

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 8
      },
      {
        time: '4:00',
        value: 9
      },
      {
        time: '6:00',
        value: 11
      },
      {
        time: '8:00',
        value: 14
      },
      {
        time: '10:00',
        value: 17
      },
      {
        time: '12:00',
        value: 19
      },
      {
        time: '14:00',
        value: 19
      },
      {
        time: '16:00',
        value: 17
      },
      {
        time: '18:00',
        value: 15
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  title: {
    text: 'Line chart',
    subtext:
      'The line chart is a simple, two-dimensional chart with an X and Y axis, each point representing a single value.',
    textStyle: {
      fontSize: 20
    },
    subtextStyle: {
      fontStyle: 'italic'
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关文档

- [更多标题 demo](https://visactor.io/vchart/demo/title/richText-title)
- [标题教程](https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Title)
- [相关 API](https://visactor.io/vchart/option/lineChart#title.text)
- [github](https://github.com/VisActor/VChart)
