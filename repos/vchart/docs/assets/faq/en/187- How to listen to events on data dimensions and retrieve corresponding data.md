---
title: How to monitor events in data dimensions and obtain corresponding data?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to monitor events in data dimensions and obtain corresponding data?</br>


## Problem Description

Hello, we have a requirement here to monitor the location of the bar chart data dimension and highlight the cells in another table based on the data corresponding to the user's click. How should this be achieved?</br>


## Solution

Users can listen to the dimensionClick event on the vchart instance to customize the operation performed after clicking on a data dimension. At the same time, the information of the corresponding data dimension can be obtained in the callback function parameters:</br>
```
vchart.on('dimensionClick', (args) => {
  const datum = args.datum;
  console.log('Dimension Click!', args, datum);
});
</br>
```


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

vchart.on('dimensionClick', (args) => {
  const datum = args.datum;
  console.log('Dimension Click!', args, datum);
});

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```


## Results

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/MzWIbQNM3olkeExmVy5cMZymnEg.gif' alt='' width='1680' height='1052'>



## Quote

*  github：https://github.com/VisActor/VChart</br>
*  Event: https://visactor.bytedance.net/vchart/api/API/event</br>

