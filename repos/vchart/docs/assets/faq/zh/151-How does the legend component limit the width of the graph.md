# 图例组件如何限制图形的宽度?

## 问题描述

使用的 vchart。在图例文字比较长的时候，期望可以限制图例项的宽度，不要出现这种分页

## 解决方案

VChart 的 图例组件提供了图例项最大宽度的配置，可以配置期望的数值，当图例项超出这个最大值时，文本会省略，并且鼠标 hover 上去时会有提示信息

```ts
legends: [
  {
    type: 'discrete',
    item: {
      maxWidth: 200
    }
  }
];
```

## 代码示例

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { type: 'Number of users who closed the video in the first 10 seconds', time: '2:00', value: 129 },
        { type: 'Number of users who closed the video in the first 10 seconds', time: '6:00', value: 133 },
        { type: 'Number of users who watched the video for more than 10 seconds', time: '2:00', value: 22 },
        { type: 'Number of users who watched the video for more than 10 seconds', time: '6:00', value: 13 }
      ]
    }
  ],
  xField: ['time', 'type'],
  yField: 'value',
  seriesField: 'type',
  legends: {
    visible: true,
    orient: 'top',
    position: 'start',
    item: {
      maxWidth: 200
    },
    maxRow: 1
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关文档

- [github](https://github.com/VisActor/VChart)
- [图例配置](https://www.visactor.io/vchart/option/barChart#legends-discrete.item.maxWidth)
