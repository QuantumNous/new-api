---
title: How to define the shape of the picture?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to define the shape of the picture?</br>


## Problem Description

I need to draw a pie chart with a legend, and I want the legend items to be in the shape of a sector. How can I achieve this? Also, how can I set the position of the legend?</br>


## Solution

The shape of the legend item can be configured through legends.item.shape.style.symbolType. The content of symbolType can be a vchart built-in shape, such as 'rect', 'circle', etc. At the same time, users can also set a custom svg path to achieve any shape.</br>
```
  legends: {
    visible: true,
    item: {
      shape: {
        style: {
          symbolType: 'rect'
          // symbolType: 'M -1 1 L 0 0 L 1 1'
        }
      }
    }
  }</br>
```
The position of the legend is configured by legends.orient , and the optional positions include: left, right, top, bottom:</br>
```
  legends: {
    visible: true,
    orient: 'right'
  }</br>
```


## Code Example

```
const data = [
  { value: 10, category: 'One' },
  { value: 9, category: 'Two' },
  { value: 6, category: 'Three' },
  { value: 5, category: 'Four' },
  { value: 4, category: 'Five' },
  { value: 3, category: 'Six' },
  { value: 1, category: 'Seven' }
];
let totalValue = 0;
data.forEach(obj => (totalValue += obj.value));
const map = {};
data.forEach(obj => {
  map[obj.category] = `${((obj.value / totalValue) * 100).toFixed(2)}%`;
});

const spec = {
  type: 'pie',
  data: [
    {
      id: 'pie',
      values: data
    }
  ],
  categoryField: 'category',
  valueField: 'value',
  legends: {
    visible: true,
    orient: 'right',
    item: {
      shape: {
        style: {
          symbolType: 'rect'
        }
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

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/JeFmb2pYUox9Kzxys4zca3K1npe.gif' alt='' width='1712' height='1086'>



## Quote

*  github：https://github.com/VisActor/VChart</br>
*  Legend shape：https://visactor.bytedance.net/vchart/option/barChart-legends-discrete#item.shape.style</br>
*  Legend orient：https://visactor.bytedance.net/vchart/option/barChart-legends-discrete#orient</br>