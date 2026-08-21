# 折线图如何配置不同线段的颜色？

## 问题描述

我正在处理一个折线图的需求，需要配置折线图中线段为不同颜色，但是我搜到的图表例子和一些库的功能都只能把折线图画成同一种颜色。请问有什么解决办法吗？

## 解决方案

在 VChart 中，折线图中不同的线段可以通过 line.style 配置项设置为不同的样式，同时 VChart 也支持设置回调函数来根据不同的数据内容返回样式结果。

## 代码示例

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        x: '1st',
        y: 0.012
      },
      {
        x: '2nd',
        y: -0.01
      },
      {
        x: '3rd',
        y: 0.005
      },
      {
        x: '4th',
        y: 0.007
      },
      {
        x: '5th',
        y: 0.01
      },
      {
        x: '6th',
        y: 0.017
      },
      {
        x: '7th',
        y: 0.022
      },
      {
        x: '8th (prediction)',
        y: 0.033,
        latest: true
      }
    ]
  },
  xField: 'x',
  yField: 'y',
  line: {
    style: {
      stroke: datum => {
        if (datum.latest) {
          return 'red';
        }
        return 'blue';
      },
      lineDash: datum => {
        if (datum.latest) {
          return [5, 5];
        }
        return [0];
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## 相关文档

- [github](https://github.com/VisActor/VChart)
- [Dashed line example](https://www.visactor.io/vchart/demo/line-chart/dash-line)
