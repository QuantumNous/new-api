---
title: 24. 条形进度图分段展示</br>
---
## 问题标题

如何将条形进度图分段展示</br>
## 问题描述

请问如何将条形进度图分段展示，如下图一样呢？</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/C0l5bguDuo5eyVxZHvKcy6icnSh.gif' alt='' width='1052' height='484'>

## 解决方案 

VChart 中可以用扩展图元来显示这每一段中的分割线</br>


## 代码示例  

```
const spec = {
  type: "linearProgress",
  data: [
    {
      id: "id0",
      values: [
        {
          type: "Tradition Industries",
          value: 0.85,
          goal: 0.7,
          text: "79.5%"
        }
      ]
    }
  ],
  direction: "horizontal",
  xField: "value",
  yField: "type",
  seriesField: "type",
  height: 80,
  cornerRadius: 20,
  progress: {
    style: {
      cornerRadius: 0
    }
  },
  bandWidth: 30,
  axes: [
    {
      orient: "right",
      type: "band",
      domainLine: { visible: false },
      tick: { visible: false },
      label: {
        formatMethod: (val) => "随便写点啥",
        style: {
          fontSize: 16
        }
      }
    },
    {
      orient: "bottom",
      type: "linear",
      visible: true,
      grid: {
        visible: false
      },
      label: {
        formatMethod: (val) => `${val * 100}%`,
        flush: true
      }
    }
  ],
  extensionMark: [
    {
      type: "rule",
      dataId: "id0",
      visible: true,
      style: {
        x: (datum, ctx, elements, dataView) => {
          return ctx.valueToX([1 / 3]);
        },
        y: (datum, ctx, elements, dataView) => {
          return ctx.valueToY([datum.type]) - 15;
        },
        x1: (datum, ctx, elements, dataView) => {
          return ctx.valueToX([1 / 3]);
        },
        y1: (datum, ctx, elements, dataView) => {
          return ctx.valueToY([datum.type]) + 15;
        },
        stroke: "#fff",
        lineWidth: 4,
        zIndex: 1
      }
    },
    {
      type: "rule",
      dataId: "id0",
      visible: true,
      style: {
        x: (datum, ctx, elements, dataView) => {
          return ctx.valueToX([2 / 3]);
        },
        y: (datum, ctx, elements, dataView) => {
          return ctx.valueToY([datum.type]) - 15;
        },
        x1: (datum, ctx, elements, dataView) => {
          return ctx.valueToX([2 / 3]);
        },
        y1: (datum, ctx, elements, dataView) => {
          return ctx.valueToY([datum.type]) + 15;
        },
        stroke: "#fff",
        lineWidth: 4,
        zIndex: 1
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID, disableTriggerEvent: true });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## 结果展示 

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/VZU8bfgIOo2HLCxhzIEc6fEInRd.gif' alt='' width='1320' height='198'>

Demo: https://codesandbox.io/p/sandbox/segment-linear-progress-3v4w5q?file=%2Fsrc%2Findex.ts%3A4%2C14-103%2C2</br>
## 相关文档

Demo：https://codesandbox.io/p/sandbox/segment-linear-progress-3v4w5q?file=%2Fsrc%2Findex.ts%3A4%2C14-103%2C2</br>
API：</br>
*  扩展mark：https://visactor.io/vchart/option/linearProgressChart#extensionMark</br>
Github：https://github.com/VisActor/VChart/</br>



