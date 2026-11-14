---
title: 24. How to display segmented linear progress bar?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## **Title**

How to display segmented linear progress bar?</br>
## **Description**

How can I display a segmented linear progress bar like the one shown in the image below?</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/YekkbAe9TohZyUx0MS0csRukncD.gif' alt='' width='1052' height='484'>

## **Solution**

In VChart, you can use extension marks to display the dividing lines between each segment.</br>
## **Code Example**

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
## **Result**

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Z6nZbmfq6oOFn4x606VcTBRqnHg.gif' alt='' width='1320' height='198'>

Demo: [https://codesandbox.io/p/sandbox/segment-linear-progress-3v4w5q?file=%2Fsrc%2Findex.ts%3A4%2C14-103%2C2](https%3A%2F%2Fcodesandbox.io%2Fp%2Fsandbox%2Fsegment-linear-progress-3v4w5q%3Ffile%3D%252Fsrc%252Findex.ts%253A4%252C14-103%252C2)</br>
## **Related Documents**

Demo：[https://codesandbox.io/p/sandbox/segment-linear-progress-3v4w5q?file=%2Fsrc%2Findex.ts%3A4%2C14-103%2C2](https%3A%2F%2Fcodesandbox.io%2Fp%2Fsandbox%2Fsegment-linear-progress-3v4w5q%3Ffile%3D%252Fsrc%252Findex.ts%253A4%252C14-103%252C2)</br>
API：</br>
*  Extension mark: [https://visactor.io/vchart/option/linearProgressChart#extensionMark](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FlinearProgressChart%23extensionMark)</br>
Github：[https://github.com/VisActor/VChart/](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart%2F)</br>