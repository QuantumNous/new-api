---
title: 71. Can the bar series listen to event callbacks?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

Can the column series listen for event callbacks?</br>
## Description

When using VChart bar chart in Mini Program, is there an event that can be called back when selecting a bar in the bar chart?</br>


## Solution 

In vchart, you can obtain the meta information of the current click by listening to pointerdown events; in addition, you can also obtain events on different elements through event filtering.</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/SgXQbLL6EoZTJmx9dW5cKmwSnvg.gif' alt='' width='2664' height='1986'>



<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/RvWtbWDG4oNsCKxvibscj89wnve.gif' alt='' width='1392' height='1488'>

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
  yField: 'sales'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
vchart.on('pointerdown', { level: 'mark' }, (...params) => console.log(params))

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## Results

Online demo：https://codesandbox.io/p/sandbox/bar-event-listener-dt8pjg?file=%2Fsrc%2Findex.ts%3A26%2C5</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/ZBhObYU2ZoHIjNxFKO1cm52jnQg.gif' alt='' width='1392' height='1488'>

## Related Documentation

Event Toturial：https://www.visactor.io/vchart/guide/tutorial_docs/Event</br>
Related Api：https://www.visactor.io/vchart/api/API/event</br>
github：https://github.com/VisActor/VChart</br>



