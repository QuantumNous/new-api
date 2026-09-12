# 如何实现反向 y 轴效果？

## 问题描述

请问 VChart 上有提供类似 echarts 的 yaxis.inverse 的配置吗？

## 解决方案

VChart 提供了轴反转的配置，对应 `inverse` 属性，只需要在对应方向的轴上进行配置即可，如下：

![](/vchart/faq/93-0.png)

## 代码示例

```javascript livedemo
const spec = {
  type: 'area',
  data: [
    {
      id: 'line',
      values: [
        { x: 'Monday', y: 12 },
        { x: 'Tuesday', y: 13 },
        { x: 'Wednesday', y: 11 },
        { x: 'Thursday', y: 10 },
        { x: 'Friday', y: 12 },
        { x: 'Saturday', y: 14 },
        { x: 'Sunday', y: 17 }
      ]
    }
  ],
  xField: 'x',
  yField: 'y',
  axes: [
    {
      zIndex: 100,
      orient: 'bottom'
    },
    {
      zIndex: 101,
      orient: 'left',
      inverse: true, // inverse the left axis
      domainLine: {
        visible: true,
        // show the endSymbol
        endSymbol: {
          visible: true,
          style: {
            fill: '#000'
          }
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关文档

- [坐标轴教程](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Axes)
- [坐标轴配置](https://www.visactor.io/vchart/option/lineChart#axes-linear.inverse)
