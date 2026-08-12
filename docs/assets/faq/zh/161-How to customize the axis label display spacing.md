# 如何自定义轴 label 显示间距？

## 问题描述

类似 （https://visactor.io/vchart/demo/line-chart/basic-line）这样的折线图，
想要实现自定义轴 label 的显示间距，该如何实现？

## 解决方案

不同图表库的解决方案不一样，根据你给的 demo，在 VChart 中只需要配置 axes 中对应轴的 label 相关配置:

- 通过 minGap 可以自定义标签之间的最小间距（单位为像素）。仅当轴采样开始时生效（sampling: true）。 该配置会影响轴采样的结果。

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
        value: 16
      },
      {
        time: '12:00',
        value: 17
      },
      {
        time: '14:00',
        value: 17
      },
      {
        time: '16:00',
        value: 16
      },
      {
        time: '18:00',
        value: 15
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  axes: [
    {
      orient: 'bottom',
      label: {
        minGap: 80
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 结果展示

- [在线效果参考](https://codesandbox.io/s/customize-axis-label-spacing-9ml6nv)

## 相关文档

- [基础折线图 demo](https://www.visactor.io/vchart/demo/line-chart/basic-line)
- [折线图教程](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Types/Line)
- [相关 api](https://www.visactor.io/vchart/option/lineChart#axes-band.label.minGap)
- [github](https://github.com/VisActor/VChart)
