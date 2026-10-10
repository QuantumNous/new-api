---
title: 85. How to configure the hover state of the mark?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to configure primitive hover status?</br>
## Description

How to enable hover highlighting effect of graphic elements?</br>


## Solution 

Taking a bar chart as an example, the highlight effect after hovering can be configured through bar.state.hover.</br>
Different charts need to be configured on different elements. Similarly, line charts are configured through line.state.hover.</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/T6hTbcvPjoqUB1xs3Znc5dh5nuf.gif' alt='' width='3244' height='1052'>



## Code Example

```
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
      ]
    }
  ],
  xField: 'month',
  yField: 'sales',
  bar: {
    state: {
      hover: {
        fill: 'red'
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## Results

Online demo：https://codesandbox.io/p/sandbox/hover-state-z5djy8?file=%2Fsrc%2Findex.ts%3A12%2C42</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Rtf6bOqUJoqmvtxo5VvcZubPnHg.gif' alt='' width='1548' height='984'>



## Related Documentation

Related API：https://www.visactor.io/vchart/option/barChart#bar.state</br>
Github：https://github.com/VisActor/VChart</br>



