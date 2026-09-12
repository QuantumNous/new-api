# 数据全 0 时，如何配置 x 轴的位置？

## 问题描述

类似 （https://www.visactor.io/vchart/demo/line-chart/basic-line）这样的数据全为0的折线图，
x 轴的位置会使折线居中。想要调整 X 轴的位置，使 X 轴与 Y 刻度为 0 对齐，该如何实现？

## 解决方案

不同图表库的解决方案不一样，根据你给的 demo，只需要将 Y 轴的 axes-linear.zero 设置为 true 即可。

- barChart-axes-linear.zero = true 仅当轴为线性轴时生效，是否包含 0 值。当配置了 min 和 max，该配置项失效。

## 代码示例

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 0
      },
      {
        time: '4:00',
        value: 0
      },
      {
        time: '6:00',
        value: 0
      },
      {
        time: '8:00',
        value: 0
      },
      {
        time: '10:00',
        value: 0
      },
      {
        time: '12:00',
        value: 0
      },
      {
        time: '14:00',
        value: 0
      },
      {
        time: '16:00',
        value: 0
      },
      {
        time: '18:00',
        value: 0
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  axes: [
    {
      orient: 'left',
      zero: true
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 结果展示

- [在线效果参考](https://codesandbox.io/s/data-is-all-0-smhq6h)

## 相关文档

- [基础折线图 demo](https://www.visactor.io/vchart/demo/line-chart/basic-line)
- [坐标轴教程](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Axes)
- [相关 api](https://www.visactor.io/vchart/option/lineChart-axes-linear#zero)
- [github](https://github.com/VisActor/VChart)
