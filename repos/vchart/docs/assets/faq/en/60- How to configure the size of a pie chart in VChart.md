---
title: 39. How to configure pie chart size in VChart？</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to configure pie chart size in VChart?</br>


## Problem Description

The page is narrow, how to adjust the configuration of VChart to make the pie chart occupy as much screen space as possible</br>


## Solution

1. Cancel the default chart padding.</br>
VChart sets a certain margin for all charts by default. You can configure `padding: 0` to cancel the default margin.</br>
1. Adjust the outerRadius  the pie chart.</br>
By default, the pie chart does not fill the entire canvas, you can configure `outerRadius: 1` to set the outer radius ratio to the highest.</br>


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

const spec = {
  type: 'pie',
  data: [
    {
      id: 'pie',
      values: data
    }
  ],
  outerRadius:1,
  padding:0,
  background:'#eeeeee',
  categoryField: 'category',
  valueField: 'value',
  
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```


## Results

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/IoQHb5VuGoNAQUxML6wchigVnbd.gif' alt='' width='1677' height='1044'>

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/FOtrbmonXopTykx090ScA7dEnRe.gif' alt='' width='1677' height='1044'>



## Quote

*  [Pie chart configuration item](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FpieChart%23outerRadius)</br>
*  github：https://github.com/VisActor/VChart</br>

