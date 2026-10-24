---
title: 71. Can a line chart be segmented?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
# Title

Can a line chart be segmented?</br>
# Description

In vchart, is it possible to segment a line chart if there is a point that you do not want to display?</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/DfQDbPMMqo6zR5xpwB1ccedXnvh.gif' alt='' width='1036' height='726'>

# Solution

If a point's value is invalid, VChart will automatically hide that point. You can set the value of that point to null in the data to achieve the same effect.</br>
For example, the point corresponding to 10:00 will not be displayed if its value is set to null.</br>
```
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
        value: null
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
  }</br>
```
# Code Example

```
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
        value: null
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
  yField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
# Result

After running the code, the point corresponding to 10:00 will not be displayed, and the line chart will be segmented.</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/EUlSbIVCQo2wy2xVlYTcegsJnMh.gif' alt='' width='1000' height='578'>

Online demo: [https://codesandbox.io/p/sandbox/line-point-split-fq7wkh?file=%2Fsrc%2Findex.ts%3A49%2C2](https%3A%2F%2Fcodesandbox.io%2Fp%2Fsandbox%2Fline-point-split-fq7wkh%3Ffile%3D%252Fsrc%252Findex.ts%253A49%252C2)</br>
# Related Documents

*  VChart official website: [https://visactor.io/vchart/](https%3A%2F%2Fvisactor.io%2Fvchart%2F)</br>
*  VChart GitHub: [GitHub - VisActor/VChart: VChart, more than just a cross-platform charting library, but also an expressive data storyteller.](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart)</br>